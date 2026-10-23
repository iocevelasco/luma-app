import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
 *
 * En desarrollo, un mail que no sale por falta de API key se imprime en la
 * consola de la API (asunto y texto, con el enlace): así se puede confirmar
 * una cuenta o aceptar una invitación en local sin configurar Resend.
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

/** Nunca en producción (datos personales en el log) ni en los tests (ruido). */
const LOG_UNSENT_MAILS = !['production', 'test'].includes(process.env.NODE_ENV ?? 'development');

/**
 * Con `EMAIL_PREVIEW_DIR`, fuera de producción, los mails no se envían: se
 * guardan como `.html` en esa carpeta para verlos en el navegador. Lo usa
 * `pnpm --filter @luma/api email:preview`.
 */
const PREVIEW_DIR = process.env.NODE_ENV === 'production' ? undefined : process.env.EMAIL_PREVIEW_DIR;

function savePreview(email: ResendEmail, label: string): void {
  mkdirSync(PREVIEW_DIR!, { recursive: true });
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const file = join(PREVIEW_DIR!, `${slug}.html`);
  writeFileSync(file, email.html);
  console.log(`👀 [EMAIL] ${label} → ${file}`);
}

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

/** Cómo se nombra cada rol en un mail. */
const ROLE_LABELS: Record<string, string> = {
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  contador: 'Contador',
  cliente: 'Cliente',
};
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

/**
 * Devuelve si el mail salió. Nunca lanza, pero tampoco calla: el que llama
 * decide qué hacer cuando es `false`. Un mail de activación que no sale y de
 * lo que nadie se entera es una persona invitada que no puede entrar.
 */
async function send(email: ResendEmail, label: string): Promise<boolean> {
  if (PREVIEW_DIR) {
    savePreview(email, label);
    return false;
  }
  const resend = await getResendClient();
  if (!resend) {
    if (LOG_UNSENT_MAILS) {
      console.log(
        `📭 [EMAIL] Sin enviar (no hay RESEND_API_KEY) — ${label} a ${email.to}\n` +
          `   Asunto: ${email.subject}\n` +
          email.text
            .split('\n')
            .map((line) => `   │ ${line}`)
            .join('\n'),
      );
    }
    return false;
  }

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

/** Para qué llegó la persona, cuando la activación viene de una invitación. */
export interface InvitationContext {
  /** Quien invitó, por su nombre. */
  inviterName?: string;
  /** La obra a la que la sumaron, si la invitación fue a una obra. */
  projectName?: string;
  /** Rol en la obra o función en el equipo. */
  role?: string;
  /** La Empresa a la que la sumaron, si la invitación fue al equipo. */
  organizationName?: string;
}

/** Los avisos de obra que además de la campanita llegan por mail. */
export type ProjectNotificationEmailType = 'actividad_en_revision' | 'eventualidad' | 'hito';

const PROJECT_NOTIFICATION_COPY: Record<
  ProjectNotificationEmailType,
  {
    subject: (subject: string, project: string) => string;
    heading: string;
    body: (subject: string, project: string) => string;
    cta: string;
    detailLabel: string;
  }
> = {
  actividad_en_revision: {
    subject: (subject, project) => `Para revisar: "${subject}" en ${project}`,
    heading: 'Hay una actividad para revisar',
    body: (_subject, project) =>
      `Reportaron terminada una actividad de <strong>${escapeHtml(project)}</strong>. Revisala y aprobala, o devolvela si falta algo.`,
    cta: 'Revisar la actividad',
    detailLabel: 'Actividad',
  },
  eventualidad: {
    subject: (subject, project) => `Eventualidad en ${project}: ${subject}`,
    heading: 'Se reportó una eventualidad',
    body: (_subject, project) =>
      `Reportaron una eventualidad en <strong>${escapeHtml(project)}</strong>. Es interna: el cliente no la ve.`,
    cta: 'Ver la eventualidad',
    detailLabel: 'Eventualidad',
  },
  hito: {
    subject: (subject, project) => `Novedades de ${project}: ${subject}`,
    heading: 'Hay novedades de tu obra',
    body: (_subject, project) =>
      `Publicaron un nuevo hito de <strong>${escapeHtml(project)}</strong>.`,
    cta: 'Ver el hito',
    detailLabel: 'Hito',
  },
};

export class EmailService {
  /**
   * Activación: la persona fue dada de alta por alguien y todavía no tiene
   * contraseña. No es el mail de verificación — ese asume que ya la eligió.
   *
   * Con `context` cuenta quién la invitó y a qué: "Te dieron de alta" a secas
   * es el tipo de mail que se borra sin leer.
   */
  static async sendAccountActivationEmail(
    email: string,
    activationToken: string,
    userName?: string,
    context?: InvitationContext,
  ): Promise<boolean> {
    const url = activationUrl(activationToken);
    const name = userName || email.split('@')[0];
    const inviter = context?.inviterName ? escapeHtml(context.inviterName) : null;

    let intro = `Te dieron de alta en <strong>${escapeHtml(APP_NAME)}</strong>.`;
    let introText = `Te dieron de alta en ${APP_NAME}.`;
    if (context?.projectName) {
      intro = `${inviter ?? 'Te'} ${inviter ? 'te invitó' : 'invitaron'} a la obra <strong>${escapeHtml(context.projectName)}</strong> en ${escapeHtml(APP_NAME)}.`;
      introText = `${context.inviterName ?? 'Te'} ${context.inviterName ? 'te invitó' : 'invitaron'} a la obra ${context.projectName} en ${APP_NAME}.`;
    } else if (context?.organizationName) {
      intro = `${inviter ?? 'Te'} ${inviter ? 'te sumó' : 'sumaron'} al equipo de <strong>${escapeHtml(context.organizationName)}</strong> en ${escapeHtml(APP_NAME)}.`;
      introText = `${context.inviterName ?? 'Te'} ${context.inviterName ? 'te sumó' : 'sumaron'} al equipo de ${context.organizationName} en ${APP_NAME}.`;
    }

    const details = [
      ...(context?.projectName ? [{ label: 'Obra', value: context.projectName }] : []),
      ...(context?.organizationName && !context.projectName
        ? [{ label: 'Empresa', value: context.organizationName }]
        : []),
      ...(context?.role ? [{ label: 'Rol', value: roleLabel(context.role) }] : []),
    ];

    return send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: context?.projectName
          ? `Te invitaron a ${context.projectName} en ${APP_NAME}`
          : `Activá tu cuenta en ${APP_NAME}`,
        html: layout({
          heading: 'Activá tu cuenta',
          preheader: 'Elegí tu contraseña para entrar. El enlace vence en 72 horas.',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>${intro} Para entrar, elegí tu contraseña.</p>`,
          details,
          cta: { label: 'Elegir mi contraseña', url },
          note: 'El enlace vence en 72 horas. Si no esperabas este correo, podés ignorarlo.',
          showFallbackLink: true,
        }),
        text: `Activá tu cuenta - ${APP_NAME}\n\nHola ${name},\n\n${introText} Elegí tu contraseña acá:\n${url}\n\nEl enlace vence en 72 horas.`,
      },
      'mail de activación',
    );
  }

  /** Verificación de email (doble opt-in) después del registro. */
  static async sendEmailVerificationEmail(
    email: string,
    verificationToken: string,
    userName?: string,
  ): Promise<boolean> {
    const url = appUrl(`/verify-email?token=${verificationToken}`);
    const name = userName || email.split('@')[0];

    return send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: `Confirmá tu cuenta en ${APP_NAME}`,
        html: layout({
          heading: 'Confirmá tu correo',
          preheader: 'Un clic y tu cuenta queda lista. El enlace vence en 24 horas.',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Gracias por registrarte en <strong>${escapeHtml(APP_NAME)}</strong>. Confirmá
               que este correo es tuyo y tu cuenta queda lista para usar.</p>`,
          cta: { label: 'Confirmar mi correo', url },
          note: 'El enlace vence en 24 horas. Si no creaste esta cuenta, podés ignorar este correo.',
          showFallbackLink: true,
        }),
        text: `Confirmá tu cuenta - ${APP_NAME}\n\nHola ${name},\n\nConfirmá tu correo acá:\n${url}\n\nEl enlace vence en 24 horas.`,
      },
      'mail de verificación',
    );
  }

  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const url = appUrl(`/reset-password?token=${resetToken}`);

    return send(
      {
        from: FROM_EMAIL,
        to: email,
        subject: `Restablecer contraseña - ${APP_NAME}`,
        html: layout({
          heading: 'Restablecé tu contraseña',
          preheader: 'Pediste una contraseña nueva. El enlace vence en 1 hora.',
          bodyHtml: `
            <p>Hola,</p>
            <p>Recibimos un pedido para restablecer la contraseña de tu cuenta en
               ${escapeHtml(APP_NAME)}.</p>`,
          cta: { label: 'Elegir una contraseña nueva', url },
          note: 'El enlace vence en 1 hora. Si no lo pediste vos, ignorá este correo: tu contraseña no cambia.',
          showFallbackLink: true,
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
  ): Promise<boolean> {
    const url = appUrl(`/confirm-email-change?token=${token}`);
    const name = userName || newEmail.split('@')[0];

    return send(
      {
        from: FROM_EMAIL,
        to: newEmail,
        subject: `Confirmá tu nuevo correo en ${APP_NAME}`,
        html: layout({
          heading: 'Confirmá tu nuevo correo',
          preheader: 'Falta un paso para cambiar el correo de tu cuenta.',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Pediste cambiar el correo de tu cuenta en ${escapeHtml(APP_NAME)} a esta
               dirección. Confirmalo para completar el cambio.</p>`,
          cta: { label: 'Confirmar mi correo', url },
          note: 'El enlace vence en 24 horas. Si no pediste este cambio, ignorá este correo: tu cuenta sigue con el correo anterior.',
          showFallbackLink: true,
        }),
        text: `Confirmá tu nuevo correo - ${APP_NAME}\n\n${url}\n\nEl enlace vence en 24 horas.`,
      },
      'mail de cambio de correo',
    );
  }

  // ── Equipo y obras ──────────────────────────────────────────────────────

  /**
   * A quien ya tenía cuenta y lo sumaron a una obra. Sin este mail, la obra
   * aparece en su lista sin que nadie le avise.
   */
  static async sendProjectInvitation(params: {
    to: string;
    name: string;
    inviterName?: string;
    projectName: string;
    projectId: string;
    role: string;
  }): Promise<boolean> {
    const url = appUrl(`/admin/proyectos/${params.projectId}`);
    const who = params.inviterName ? escapeHtml(params.inviterName) : 'Alguien';
    return send(
      {
        from: FROM_EMAIL,
        to: params.to,
        subject: `Te sumaron a la obra ${params.projectName}`,
        html: layout({
          heading: 'Te sumaron a una obra',
          preheader: `Ya podés ver ${params.projectName} en ${APP_NAME}.`,
          bodyHtml: `
            <p>Hola ${escapeHtml(params.name)},</p>
            <p>${who} te sumó a una obra en ${escapeHtml(APP_NAME)}. Ya la tenés en tu lista de obras.</p>`,
          details: [
            { label: 'Obra', value: params.projectName },
            { label: 'Rol', value: roleLabel(params.role) },
          ],
          cta: { label: 'Ver la obra', url },
        }),
        text: `Te sumaron a una obra - ${APP_NAME}\n\nHola ${params.name},\n\n${params.inviterName ?? 'Alguien'} te sumó a la obra ${params.projectName} como ${roleLabel(params.role)}.\n\n${url}`,
      },
      'aviso de invitación a obra',
    );
  }

  /** A quien ya tenía cuenta y lo sumaron al equipo de una Empresa. */
  static async sendTeamInvitation(params: {
    to: string;
    name: string;
    inviterName?: string;
    organizationName: string;
    staffRole?: string;
  }): Promise<boolean> {
    const url = appUrl('/admin');
    const who = params.inviterName ? escapeHtml(params.inviterName) : 'Alguien';
    return send(
      {
        from: FROM_EMAIL,
        to: params.to,
        subject: `Te sumaron al equipo de ${params.organizationName}`,
        html: layout({
          heading: 'Te sumaron a un equipo',
          preheader: `Ahora sos parte de ${params.organizationName} en ${APP_NAME}.`,
          bodyHtml: `
            <p>Hola ${escapeHtml(params.name)},</p>
            <p>${who} te sumó al equipo de una Empresa en ${escapeHtml(APP_NAME)}. Vas a ver
               sus obras a medida que te inviten a cada una.</p>`,
          details: [
            { label: 'Empresa', value: params.organizationName },
            ...(params.staffRole ? [{ label: 'Función', value: roleLabel(params.staffRole) }] : []),
          ],
          cta: { label: `Entrar a ${APP_NAME}`, url },
        }),
        text: `Te sumaron a un equipo - ${APP_NAME}\n\nHola ${params.name},\n\n${params.inviterName ?? 'Alguien'} te sumó al equipo de ${params.organizationName}.\n\n${url}`,
      },
      'aviso de invitación al equipo',
    );
  }

  /**
   * El mail que acompaña a un aviso de obra (la campanita). Sólo los que piden
   * que alguien haga algo o que el cliente se entere: ver
   * `notification-email.service.ts`.
   */
  static async sendProjectNotification(params: {
    to: string;
    name: string;
    type: ProjectNotificationEmailType;
    projectName: string;
    subjectName: string;
    /** Ruta de la SPA, la misma del aviso. */
    link: string;
  }): Promise<boolean> {
    const copy = PROJECT_NOTIFICATION_COPY[params.type];
    const url = appUrl(params.link);
    const subject = copy.subject(params.subjectName, params.projectName);
    return send(
      {
        from: FROM_EMAIL,
        to: params.to,
        subject,
        html: layout({
          heading: copy.heading,
          preheader: `${params.projectName}: ${params.subjectName}`,
          bodyHtml: `
            <p>Hola ${escapeHtml(params.name)},</p>
            <p>${copy.body(params.subjectName, params.projectName)}</p>`,
          details: [
            { label: 'Obra', value: params.projectName },
            { label: copy.detailLabel, value: params.subjectName },
          ],
          cta: { label: copy.cta, url },
        }),
        text: `${copy.heading} - ${APP_NAME}\n\nHola ${params.name},\n\nObra: ${params.projectName}\n${copy.detailLabel}: ${params.subjectName}\n\n${url}`,
      },
      `aviso de ${params.type}`,
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
          preheader: `Tu plan Pro está activo hasta el ${until}.`,
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Revisamos tu pago en bolívares y está todo bien. Ya tenés el plan
               <strong>Pro</strong>.</p>`,
          details: [
            { label: 'Plan', value: 'Pro' },
            { label: 'Activo hasta', value: until },
          ],
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
          preheader: 'Revisá el motivo y mandalo de nuevo.',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Revisamos tu pago en bolívares y no lo pudimos aprobar.</p>`,
          details: [{ label: 'Motivo', value: reason }],
          cta: { label: 'Ir a mi suscripción', url },
          note: 'Podés mandarlo de nuevo desde tu suscripción, con la misma referencia si fue un error de carga.',
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
          preheader: `${details.organization}: ${details.amountBs}`,
          bodyHtml: `
            <p>Entró un pago en bolívares de la suscripción.</p>
            ${
              details.mismatch
                ? '<p><strong>Ojo:</strong> lo que declaró pagar no coincide con lo cotizado. Revisalo en el banco.</p>'
                : ''
            }`,
          details: [
            { label: 'Empresa', value: details.organization },
            { label: 'Dueño', value: details.owner },
            { label: 'Monto', value: `${details.amountBs} (${details.totalUsd})` },
          ],
          cta: { label: 'Revisar pagos', url },
          note: 'Mientras está en revisión, la cuenta sigue con acceso completo 72 horas.',
        }),
        text: `Pago para revisar - ${APP_NAME}\n\n${details.organization} (${details.owner}): ${details.amountBs} (${details.totalUsd}).${details.mismatch ? ' No coincide con lo cotizado.' : ''}\n\n${url}`,
      },
      'aviso de pago a revisar',
    );
  }

  /**
   * Se termina el plan Gratis. `cardEnabled`: si se ofrece pagar con tarjeta
   * (ver `STRIPE_CONFIG.ENABLED`); sin ella, el mail no la menciona.
   */
  static async sendTrialEnding(
    to: string,
    name: string,
    daysLeft: number,
    trialEndsAt: Date,
    cardEnabled = false,
  ): Promise<boolean> {
    const url = subscriptionUrl();
    const when = daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
    const date = longDate(trialEndsAt);
    const howToPay = cardEnabled ? 'con tarjeta o en bolívares' : 'en bolívares';
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Tu plan Gratis de ${APP_NAME} termina ${when}`,
        html: layout({
          heading: `Tu plan Gratis termina ${when}`,
          preheader: `Pasá a Pro antes del ${date} para seguir editando tus obras.`,
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>El <strong>${date}</strong> termina tu plan Gratis. Para seguir editando tus
               obras, pasá a <strong>Pro</strong>: $39 por mes con 3 obras incluidas.</p>
            <p>Podés pagar ${howToPay}. Si pagás ahora, Pro arranca cuando termine el
               plan Gratis: no perdés ningún día.</p>`,
          cta: { label: 'Pasar a Pro', url },
          note: 'Si no pasás a Pro no se borra nada: tus obras quedan en sólo lectura hasta que pagues.',
        }),
        text: `Tu plan Gratis termina ${when} - ${APP_NAME}\n\nHola ${name},\n\nEl ${date} termina tu plan Gratis. Pasá a Pro para seguir editando:\n${url}`,
      },
      'recordatorio de fin de prueba',
    );
  }

  /** Venció: sus obras quedan en sólo lectura. */
  static async sendSubscriptionExpired(to: string, name: string, cardEnabled = false): Promise<boolean> {
    const url = subscriptionUrl();
    return send(
      {
        from: FROM_EMAIL,
        to,
        subject: `Tus obras en ${APP_NAME} quedaron en sólo lectura`,
        html: layout({
          heading: 'Tu suscripción venció',
          preheader: 'No se borró nada: pagá Pro y volvés a editar.',
          bodyHtml: `
            <p>Hola ${escapeHtml(name)},</p>
            <p>Tus obras quedaron en <strong>sólo lectura</strong>: podés verlas, pero no
               cambiarlas. No se borró nada.</p>
            <p>${
              cardEnabled
                ? 'Pagá el plan Pro y volvés a editar en el momento (con tarjeta) o apenas aprobemos tu pago (en bolívares).'
                : 'Pagá el plan Pro en bolívares y volvés a editar apenas aprobemos tu pago.'
            }</p>`,
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
          preheader: 'Revisá tu tarjeta para no perder el acceso.',
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
