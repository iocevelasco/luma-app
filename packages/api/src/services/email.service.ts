import { EMAIL_CONFIG } from '../config/app.config.js';
import { activationUrl } from '../utils/activation.js';
import { appUrl } from '../utils/app-url.js';
import { escapeHtml, renderEmailLayout, type EmailLayoutOptions } from './email-layout.js';

/**
 * Envío de mails transaccionales vía Resend.
 *
 * El cliente se carga de forma perezosa y, si no hay API key o el paquete no
 * está, cada método devuelve sin hacer nada. Es deliberado: en desarrollo se
 * trabaja sin credenciales de mail y el flujo de registro tiene que seguir
 * andando. Ningún método lanza — un fallo de mail no puede tumbar un login.
 */

type ResendEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

type ResendClient = {
  emails: { send: (options: ResendEmail) => Promise<unknown> };
};

let resendClient: ResendClient | null = null;
let resendInitialized = false;

async function getResendClient(): Promise<ResendClient | null> {
  if (resendInitialized) return resendClient;
  resendInitialized = true;

  if (!EMAIL_CONFIG.RESEND_API_KEY) {
    console.warn('⚠️  [EMAIL] Sin RESEND_API_KEY: los mails quedan deshabilitados.');
    return null;
  }

  try {
    const { Resend } = await import('resend');
    resendClient = new Resend(EMAIL_CONFIG.RESEND_API_KEY) as unknown as ResendClient;
    console.log('✅ [EMAIL] Cliente de Resend inicializado');
    return resendClient;
  } catch {
    console.warn('⚠️  [EMAIL] El paquete `resend` no está disponible.');
    return null;
  }
}

const FROM_EMAIL = EMAIL_CONFIG.FROM;
const APP_NAME = EMAIL_CONFIG.APP_NAME;

/** La pantalla de Suscripción del panel: a donde llevan los mails de cobro. */
const subscriptionUrl = () => appUrl('/admin/settings/subscription');

/** "19 de noviembre de 2026", en la hora de Caracas. */
function longDate(date: Date): string {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'long',
    timeZone: 'America/Caracas',
  }).format(date);
}

const layout = (o: Omit<EmailLayoutOptions, 'appName'>) =>
  renderEmailLayout({ ...o, appName: APP_NAME });

/**
 * Devuelve si el mail salió. Nunca lanza, pero tampoco calla: el que llama
 * decide qué hacer cuando es `false`. Un mail de activación que no sale y de
 * lo que nadie se entera es una persona invitada que no puede entrar.
 */
async function send(email: ResendEmail, label: string): Promise<boolean> {
  const resend = await getResendClient();
  if (!resend) return false;

  try {
    const result = (await resend.emails.send(email)) as { error?: unknown } | undefined;
    // El SDK de Resend no lanza ante un rechazo de la API (remitente sin
    // verificar, destinatario no permitido): devuelve `{ error }`.
    if (result?.error) {
      console.error(`❌ [EMAIL] Resend rechazó el ${label} a ${email.to}:`, result.error);
      return false;
    }
    console.log(`✅ [EMAIL] ${label} enviado a: ${email.to}`);
    return true;
  } catch (error) {
    console.error(`❌ [EMAIL] Falló el envío de ${label}:`, error);
    return false;
  }
}

export class EmailService {
  /**
   * Activación: la persona fue dada de alta por un admin y todavía no tiene
   * contraseña. No es el mail de verificación — ese asume que ya la eligió.
   */
  static async sendAccountActivationEmail(
    email: string,
    activationToken: string,
    userName?: string,
  ): Promise<boolean> {
    const url = activationUrl(activationToken);
    const name = userName || email.split('@')[0];

    return send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: `Activá tu cuenta en ${APP_NAME}`,
        html: layout({
          heading: 'Activá tu cuenta',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Te dieron de alta en <strong>${escapeHtml(APP_NAME)}</strong>. Elegí tu
               contraseña para entrar a tu cuenta.</p>
            <p>O copiá y pegá este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${url}</p>
            <p><strong>El enlace vence en 72 horas.</strong></p>
            <p>Si no esperabas este correo, podés ignorarlo.</p>`,
          cta: { label: 'Elegir mi contraseña', url },
        }),
        text: `Activá tu cuenta - ${APP_NAME}\n\nHola ${name},\n\nElegí tu contraseña acá:\n${url}\n\nEl enlace vence en 72 horas.`,
      },
      'mail de activación',
    );
  }

  /** Verificación de email (doble opt-in) después del registro. */
  static async sendEmailVerificationEmail(
    email: string,
    verificationToken: string,
    userName?: string,
  ): Promise<void> {
    const url = appUrl(`/verify-email?token=${verificationToken}`);
    const name = userName || email.split('@')[0];

    await send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: `Confirmá tu cuenta en ${APP_NAME}`,
        html: layout({
          heading: 'Confirmá tu cuenta',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Gracias por registrarte en <strong>${escapeHtml(APP_NAME)}</strong>. Para
               activar tu cuenta, confirmá tu dirección de correo.</p>
            <p>O copiá y pegá este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${url}</p>
            <p><strong>El enlace vence en 24 horas.</strong></p>
            <p>Si no creaste esta cuenta, podés ignorar este correo.</p>`,
          cta: { label: 'Confirmar mi cuenta', url },
        }),
        text: `Confirmá tu cuenta - ${APP_NAME}\n\nHola ${name},\n\n${url}\n\nEl enlace vence en 24 horas.`,
      },
      'mail de verificación',
    );
  }

  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const url = appUrl(`/reset-password?token=${resetToken}`);

    await send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: `Restablecer contraseña - ${APP_NAME}`,
        html: layout({
          heading: 'Restablecer contraseña',
          bodyHtml: `
            <p>Hola,</p>
            <p>Recibimos un pedido para restablecer la contraseña de tu cuenta en
               ${escapeHtml(APP_NAME)}.</p>
            <p>O copiá y pegá este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${url}</p>
            <p><strong>El enlace vence en 1 hora.</strong></p>
            <p>Si no pediste este cambio, podés ignorar este correo.</p>`,
          cta: { label: 'Restablecer contraseña', url },
        }),
        text: `Restablecer contraseña - ${APP_NAME}\n\n${url}\n\nEl enlace vence en 1 hora.`,
      },
      'mail de reset',
    );
  }

  /** Confirmación de cambio de email: se manda a la dirección NUEVA. */
  static async sendEmailChangeConfirmationEmail(
    newEmail: string,
    token: string,
    userName?: string,
  ): Promise<void> {
    const url = appUrl(`/confirm-email-change?token=${token}`);
    const name = userName || newEmail.split('@')[0];

    await send(
      {
        from: FROM_EMAIL,
        to: newEmail,
        subject: `Confirmá tu nuevo correo en ${APP_NAME}`,
        html: layout({
          heading: 'Confirmá tu nuevo correo',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Pediste cambiar el correo de tu cuenta en ${escapeHtml(APP_NAME)} a esta
               dirección. Confirmalo para completar el cambio.</p>
            <p>O copiá y pegá este enlace en tu navegador:</p>
            <p style="word-break: break-all;">${url}</p>
            <p><strong>El enlace vence en 24 horas.</strong></p>
            <p>Si no pediste este cambio, ignorá este correo: tu cuenta sigue con el
               correo anterior.</p>`,
          cta: { label: 'Confirmar mi correo', url },
        }),
        text: `Confirmá tu nuevo correo - ${APP_NAME}\n\n${url}\n\nEl enlace vence en 24 horas.`,
      },
      'mail de cambio de correo',
    );
  }

  // ── Suscripción ─────────────────────────────────────────────────────────

  /** Pago en Bs aprobado: ya es Pro, hasta cuándo. */
  static async sendSubscriptionPaymentApproved(
    to: string,
    name: string,
    paidUntil: Date,
  ): Promise<boolean> {
    const url = subscriptionUrl();
    const until = longDate(paidUntil);
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Aprobamos tu pago: ya tenés ${APP_NAME} Pro`,
        html: layout({
          heading: 'Aprobamos tu pago',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Revisamos tu pago en bolívares y está todo bien. Tu plan
               <strong>Pro</strong> está activo hasta el <strong>${until}</strong>.</p>`,
          cta: { label: 'Ver mi suscripción', url },
        }),
        text: `Aprobamos tu pago - ${APP_NAME}\n\nHola ${name},\n\nTu plan Pro está activo hasta el ${until}.\n\n${url}`,
      },
      'mail de pago aprobado',
    );
  }

  /** Pago en Bs rechazado, con el motivo que escribió quien lo revisó. */
  static async sendSubscriptionPaymentRejected(
    to: string,
    name: string,
    reason: string,
  ): Promise<boolean> {
    const url = subscriptionUrl();
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `No pudimos aprobar tu pago - ${APP_NAME}`,
        html: layout({
          heading: 'No pudimos aprobar tu pago',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Revisamos tu pago en bolívares y no lo pudimos aprobar:</p>
            <p style="padding: 12px 16px; background: #ffffff; border-radius: 8px;">${escapeHtml(reason)}</p>
            <p>Podés mandarlo de nuevo desde tu suscripción, con la misma referencia
               si fue un error de carga.</p>`,
          cta: { label: 'Ir a mi suscripción', url },
        }),
        text: `No pudimos aprobar tu pago - ${APP_NAME}\n\nHola ${name},\n\nMotivo: ${reason}\n\nPodés mandarlo de nuevo acá:\n${url}`,
      },
      'mail de pago rechazado',
    );
  }

  /** Al admin de la plataforma: entró un pago en Bs para revisar. */
  static async sendSubscriptionPaymentToReview(
    to: string,
    details: { organization: string; owner: string; amountBs: string; totalUsd: string; mismatch: boolean },
  ): Promise<boolean> {
    const url = appUrl('/admin/plataforma/pagos');
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Pago en bolívares para revisar: ${details.organization}`,
        html: layout({
          heading: 'Hay un pago para revisar',
          bodyHtml: `
            <p><strong>${escapeHtml(details.organization)}</strong> (${escapeHtml(details.owner)})
               mandó un pago de <strong>${escapeHtml(details.amountBs)}</strong>
               (${escapeHtml(details.totalUsd)}).</p>
            ${
              details.mismatch
                ? '<p><strong>Ojo:</strong> lo que declaró pagar no coincide con lo cotizado. Revisalo en el banco.</p>'
                : ''
            }
            <p>Mientras está en revisión, la cuenta sigue con acceso completo 72 horas.</p>`,
          cta: { label: 'Revisar pagos', url },
        }),
        text: `Pago para revisar - ${APP_NAME}\n\n${details.organization} (${details.owner}): ${details.amountBs} (${details.totalUsd}).${details.mismatch ? ' No coincide con lo cotizado.' : ''}\n\n${url}`,
      },
      'aviso de pago a revisar',
    );
  }

  /** Se termina el plan Gratis. */
  static async sendTrialEnding(
    to: string,
    name: string,
    daysLeft: number,
    trialEndsAt: Date,
  ): Promise<boolean> {
    const url = subscriptionUrl();
    const when = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
    const date = longDate(trialEndsAt);
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Tu plan Gratis de ${APP_NAME} termina ${when}`,
        html: layout({
          heading: `Tu plan Gratis termina ${when}`,
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>El ${date} termina tu plan Gratis. Para seguir editando tus obras, pasá a
               <strong>Pro</strong>: $39 por mes con 3 obras incluidas.</p>
            <p>Podés pagar con tarjeta o en bolívares. Si pagás ahora, arranca cuando
               termine el plan Gratis: no perdés ningún día.</p>
            <p>Si no pasás a Pro no se borra nada: tus obras quedan en sólo lectura
               hasta que pagues.</p>`,
          cta: { label: 'Pasar a Pro', url },
        }),
        text: `Tu plan Gratis termina ${when} - ${APP_NAME}\n\nHola ${name},\n\nEl ${date} termina tu plan Gratis. Pasá a Pro para seguir editando:\n${url}`,
      },
      'recordatorio de fin de prueba',
    );
  }

  /** Venció: sus obras quedan en sólo lectura. */
  static async sendSubscriptionExpired(to: string, name: string): Promise<boolean> {
    const url = subscriptionUrl();
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Tus obras en ${APP_NAME} quedaron en sólo lectura`,
        html: layout({
          heading: 'Tu suscripción venció',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Tus obras quedaron en <strong>sólo lectura</strong>: podés verlas, pero no
               cambiarlas. No se borró nada.</p>
            <p>Pagá el plan Pro y volvés a editar en el momento (con tarjeta) o apenas
               aprobemos tu pago (en bolívares).</p>`,
          cta: { label: 'Renovar', url },
        }),
        text: `Tu suscripción venció - ${APP_NAME}\n\nHola ${name},\n\nTus obras quedaron en sólo lectura. Renová acá:\n${url}`,
      },
      'aviso de suscripción vencida',
    );
  }

  /** Stripe no pudo cobrar la renovación. */
  static async sendCardPaymentFailed(to: string, name: string): Promise<boolean> {
    const url = subscriptionUrl();
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `No pudimos cobrar tu tarjeta - ${APP_NAME}`,
        html: layout({
          heading: 'No pudimos cobrar tu tarjeta',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Intentamos cobrar la renovación de tu plan Pro y la tarjeta la rechazó.
               Vamos a reintentar en los próximos días.</p>
            <p>Para no perder el acceso, revisá o cambiá la tarjeta desde tu
               suscripción ("Administrar tarjeta").</p>`,
          cta: { label: 'Revisar mi tarjeta', url },
        }),
        text: `No pudimos cobrar tu tarjeta - ${APP_NAME}\n\nHola ${name},\n\nRevisá o cambiá tu tarjeta acá:\n${url}`,
      },
      'aviso de cobro fallido',
    );
  }
}

export default EmailService;
