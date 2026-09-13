import { EMAIL_CONFIG } from '../config/app.config.js';
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

const layout = (o: Omit<EmailLayoutOptions, 'appName'>) =>
  renderEmailLayout({ ...o, appName: APP_NAME });

async function send(email: ResendEmail, label: string): Promise<void> {
  const resend = await getResendClient();
  if (!resend) return;

  try {
    await resend.emails.send(email);
    console.log(`✅ [EMAIL] ${label} enviado a: ${email.to}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Falló el envío de ${label}:`, error);
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
  ): Promise<void> {
    const url = appUrl(`/activate?token=${activationToken}`);
    const name = userName || email.split('@')[0];

    await send(
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
}

export default EmailService;
