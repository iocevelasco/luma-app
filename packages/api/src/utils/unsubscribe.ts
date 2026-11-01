import { createHmac, timingSafeEqual } from 'node:crypto';
import { JWT_CONFIG, SERVER_CONFIG } from '../config/app.config.js';

/**
 * Enlace de baja de los comunicados. Se firma con HMAC sobre el id de la
 * cuenta: sin firma cualquiera podría dar de baja a cualquiera adivinando ids.
 * No vence — una baja tiene que funcionar en un correo de hace un año.
 */
function secret(): string {
  const key = JWT_CONFIG.SECRET ?? JWT_CONFIG.PRIVATE_KEY_PEM;
  if (!key) throw new Error('No hay clave para firmar el enlace de baja');
  return key;
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(`unsubscribe:${userId}`).digest('hex');
}

export function unsubscribeUrl(userId: string): string {
  const base = SERVER_CONFIG.PUBLIC_API_URL.replace(/\/$/, '');
  return `${base}/api/public/unsubscribe?u=${encodeURIComponent(userId)}&s=${sign(userId)}`;
}

export function isValidUnsubscribe(userId: string, signature: string): boolean {
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
