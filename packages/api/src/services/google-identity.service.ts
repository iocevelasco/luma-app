import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CONFIG } from '../config/app.config.js';
import { googleEmailNotVerified, googleTokenInvalid, serviceUnavailable } from '../utils/errors.js';

/**
 * Verificación del ID token que entrega el botón de Google (ADR-005 §1.3).
 *
 * `verifyIdToken` comprueba la firma contra las claves públicas de Google
 * (las cachea), el emisor, la audiencia y el vencimiento. Encima de eso:
 * `email_verified` estricto, y el correo en minúsculas sin tocar puntos ni `+`.
 *
 * La credencial **nunca se loguea**: es un token que, mientras no vence, abre
 * la cuenta.
 */

export interface GoogleIdentity {
  /** El id estable de la cuenta de Google: la identidad, no el correo. */
  sub: string;
  email: string;
  name: string;
  /** Dominio de Workspace, si la cuenta es de una organización. */
  hd?: string;
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** Lo que importa del payload; separado para poder probarlo sin red. */
interface GooglePayload {
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
}

export type GoogleVerifier = (credential: string, audience: string) => Promise<GooglePayload | undefined>;

let client: OAuth2Client | null = null;

const verifyWithGoogle: GoogleVerifier = async (credential, audience) => {
  client ??= new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  return ticket.getPayload();
};

export async function verifyGoogleCredential(
  credential: string,
  verify: GoogleVerifier = verifyWithGoogle,
  clientId: string | undefined = GOOGLE_CONFIG.CLIENT_ID,
): Promise<GoogleIdentity> {
  if (!clientId) {
    throw serviceUnavailable('Entrar con Google no está disponible ahora.');
  }

  let payload: GooglePayload | undefined;
  try {
    payload = await verify(credential, clientId);
  } catch {
    // El motivo (firma, audiencia, vencido) es para nosotros, no para quien entra.
    throw googleTokenInvalid();
  }

  if (!payload?.sub || !payload.email || !payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw googleTokenInvalid();
  }
  if (payload.email_verified !== true) {
    throw googleEmailNotVerified();
  }

  const email = payload.email.trim().toLowerCase();
  return {
    sub: payload.sub,
    email,
    name: payload.name?.trim() || email.split('@')[0],
    hd: payload.hd?.trim().toLowerCase() || undefined,
  };
}

/**
 * ¿Google es autoridad sobre este correo? (ADR-005 §1.7)
 *
 * Sólo para `@gmail.com` y para cuentas de Workspace cuyo dominio (`hd`) es el
 * del correo. Para cualquier otro, una cuenta de Google puede tener ese correo
 * "verificado" sin que la persona controle hoy la casilla: alcanza para crear
 * una cuenta nueva sin verificar, no para activar una que ya existe.
 */
export function isGoogleAuthoritative(identity: Pick<GoogleIdentity, 'email' | 'hd'>): boolean {
  const domain = identity.email.split('@')[1];
  if (!domain) return false;
  return domain === 'gmail.com' || (Boolean(identity.hd) && identity.hd === domain);
}
