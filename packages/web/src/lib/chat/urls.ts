import { ALLOWED_REMOTE_IMAGE_ORIGINS } from './limits';

/**
 * Validación de URLs del chat. Se parsea con `URL` y se decide por protocolo y
 * origen contra una lista cerrada; nunca con expresiones regulares ni quitando
 * texto. Las URLs que llegan del asistente, del historial o de un título son
 * contenido no confiable.
 */
export type UrlPurpose = 'link' | 'remote-image' | 'local-preview';

export type UrlBlockReason =
  | 'invalid'
  | 'protocol'
  | 'credentials'
  | 'origin'
  | 'not-local'
  | 'too-long';

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: UrlBlockReason };

const MAX_URL_LENGTH = 2048;

/**
 * Vistas previas `blob:` creadas por esta aplicación. Una URL `blob:` que
 * viene de afuera (asistente, historial restaurado) no está acá y se bloquea.
 */
const localPreviews = new Set<string>();

export function createLocalPreview(file: Blob): string {
  const url = URL.createObjectURL(file);
  localPreviews.add(url);
  return url;
}

export function revokeLocalPreview(url: string | undefined): void {
  if (!url || !localPreviews.delete(url)) return;
  URL.revokeObjectURL(url);
}

export function isLocalPreview(url: string): boolean {
  return localPreviews.has(url);
}

export function checkUrl(
  raw: unknown,
  purpose: UrlPurpose,
  allowedOrigins: readonly string[] = ALLOWED_REMOTE_IMAGE_ORIGINS,
): UrlCheck {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: 'invalid' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'too-long' };

  // Un blob se valida contra el registro, no contra su forma.
  if (purpose === 'local-preview') {
    return isLocalPreview(raw) ? { ok: true, url: raw } : { ok: false, reason: 'not-local' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  // Lista cerrada: todo lo que no sea https (javascript:, vbscript:, file:,
  // data:, blob:, http:…) se rechaza.
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' };

  if (purpose === 'remote-image' && !allowedOrigins.includes(parsed.origin)) {
    return { ok: false, reason: 'origin' };
  }
  return { ok: true, url: parsed.href };
}
