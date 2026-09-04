import { EMAIL_CONFIG, EMAIL_ENABLED } from '../config/app.config.js';

/**
 * Envío de emails.
 *
 * Sin `RESEND_API_KEY` no falla: loguea. Así el entorno de desarrollo no
 * necesita credenciales y el flujo de verificación se puede probar copiando el
 * link de la consola.
 *
 * El SDK se importa de forma perezosa para no pagar su carga cuando el email
 * está deshabilitado.
 */
type ResendClient = { emails: { send: (opts: Record<string, unknown>) => Promise<unknown> } };
let resend: ResendClient | null = null;

async function getClient(): Promise<ResendClient | null> {
  if (!EMAIL_ENABLED) return null;
  if (resend) return resend;
  const { Resend } = await import('resend');
  resend = new Resend(EMAIL_CONFIG.RESEND_API_KEY) as unknown as ResendClient;
  return resend;
}

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a8a29e">${EMAIL_CONFIG.APP_NAME}</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#44403c">${bodyHtml}</div>
      ${
        cta
          ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px">${cta.label}</a></p>`
          : ''
      }
    </div>
    <p style="margin:16px 4px 0;font-size:12px;color:#a8a29e">Este mensaje se generó automáticamente desde ${EMAIL_CONFIG.APP_NAME}.</p>
  </div>
</body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    console.log(`📧 [EMAIL:consola] Para: ${to} — ${subject}`);
    const link = html.match(/href="([^"]+)"/)?.[1];
    if (link) console.log(`   ↳ ${link}`);
    return;
  }
  try {
    await client.emails.send({ from: EMAIL_CONFIG.FROM_EMAIL, to, subject, html });
  } catch (error) {
    // Un email que no sale no puede tumbar la operación que lo disparó: el
    // imprevisto ya se aprobó, la notificación in-app ya está.
    console.error(`❌ [EMAIL] No se pudo enviar a ${to}:`, error);
  }
}

const appUrl = () => EMAIL_CONFIG.APP_URL.replace(/\/$/, '');

export const EmailService = {
  async sendVerification(to: string, token: string, name?: string) {
    const url = `${appUrl()}/verify-email?token=${token}`;
    await send(
      to,
      `Confirmá tu email en ${EMAIL_CONFIG.APP_NAME}`,
      layout(
        `Hola${name ? ` ${name}` : ''}`,
        '<p>Confirmá tu dirección de email para empezar a usar la plataforma.</p>',
        { label: 'Confirmar email', url },
      ),
    );
  },

  async sendPasswordReset(to: string, token: string) {
    const url = `${appUrl()}/reset-password?token=${token}`;
    await send(
      to,
      'Restablecer tu contraseña',
      layout(
        'Restablecer contraseña',
        '<p>Pediste cambiar tu contraseña. El link vence en 1 hora.</p><p>Si no fuiste vos, ignorá este mensaje: tu contraseña sigue igual.</p>',
        { label: 'Elegir nueva contraseña', url },
      ),
    );
  },

  async sendInvitation(to: string, token: string, projectName: string, inviterName: string) {
    const url = `${appUrl()}/activate?token=${token}`;
    await send(
      to,
      `${inviterName} te invitó a ${projectName}`,
      layout(
        `Te invitaron a ${projectName}`,
        `<p><strong>${inviterName}</strong> te sumó al proyecto <strong>${projectName}</strong> en ${EMAIL_CONFIG.APP_NAME}.</p><p>Elegí una contraseña para entrar.</p>`,
        { label: 'Activar mi cuenta', url },
      ),
    );
  },

  async sendProjectAdded(to: string, projectName: string, inviterName: string) {
    await send(
      to,
      `Te sumaron a ${projectName}`,
      layout(
        `Te sumaron a ${projectName}`,
        `<p><strong>${inviterName}</strong> te dio acceso al proyecto <strong>${projectName}</strong>.</p>`,
        { label: 'Ver el proyecto', url: `${appUrl()}/` },
      ),
    );
  },

  /**
   * Comunicación de imprevisto al cliente (RF-08 paso 3, RF-09).
   *
   * El sobrecosto NUNCA va como cifra aislada: siempre contra el total y el
   * margen restante. Es una regla de diseño del documento, no una decisión de
   * maquetado.
   */
  async sendContingencyToClient(
    to: string,
    params: {
      projectName: string;
      code: string;
      what: string;
      why: string;
      impactCost: string;
      impactDays: number;
      budgetTotal: string;
      remaining: string;
      link: string;
      options: Array<{ description: string; cost: string }>;
    },
  ) {
    const options = params.options.length
      ? `<p style="margin-top:16px"><strong>Alternativas</strong></p><ul>${params.options
          .map((o) => `<li>${o.description} — ${o.cost}</li>`)
          .join('')}</ul>`
      : '';

    await send(
      to,
      `${params.projectName}: hay una decisión esperándote (${params.code})`,
      layout(
        `Una novedad en ${params.projectName}`,
        `<p><strong>Qué pasó.</strong> ${params.what}</p>
         <p><strong>Por qué.</strong> ${params.why}</p>
         <p><strong>Qué implica.</strong> ${params.impactCost}${
           params.impactDays ? ` y ${params.impactDays} día(s) de plazo` : ''
         }.</p>
         <p style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:12px 14px">
           Sobre un presupuesto total de <strong>${params.budgetTotal}</strong>, después de esto quedarían
           <strong>${params.remaining}</strong> disponibles.
         </p>
         ${options}`,
        { label: 'Ver y decidir', url: params.link },
      ),
    );
  },

  async sendWeeklySummary(to: string, projectName: string, html: string, link: string) {
    await send(
      to,
      `Resumen semanal — ${projectName}`,
      layout(`Cómo viene ${projectName}`, html, { label: 'Ver el detalle', url: link }),
    );
  },
};
