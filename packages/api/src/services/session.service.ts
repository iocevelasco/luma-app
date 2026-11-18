import type { JWTPayload } from '@luma/shared';
import { User } from '../models/User.js';

/**
 * Versión de las sesiones de cada cuenta (`User.tokenVersion`).
 *
 * `isAuthenticated` la compara en cada request. Leerla siempre de la base
 * sería una consulta más por request; con este caché es una por persona cada
 * `CACHE_TTL_MS`. El costo: una sesión cerrada desde **otro proceso** (un
 * script) puede seguir viva hasta ese tiempo. Las que cierra la API, no:
 * `forgetTokenVersion` borra la entrada en el momento.
 *
 * El caché vive en memoria del proceso. Con una sola instancia de la API (hoy,
 * en Coolify) alcanza; con varias, cada una tendría el suyo y la demora sería
 * la misma, `CACHE_TTL_MS`.
 */
export const CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 10_000;

const cache = new Map<string, { version: number; at: number }>();

/** El `tv` del token; un token anterior a `tokenVersion` cuenta como 0. */
export function tokenVersionOf(payload: Pick<JWTPayload, 'tv'>): number {
  return typeof payload.tv === 'number' ? payload.tv : 0;
}

/**
 * La versión vigente de la cuenta, o `null` si la cuenta no existe. No mira si
 * está activa: eso lo resuelve el refresh, como hasta ahora.
 */
export async function currentTokenVersion(userId: string, now = Date.now()): Promise<number | null> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.version;

  const user = await User.findById(userId).select('tokenVersion').lean<{ tokenVersion?: number }>();
  if (!user) {
    cache.delete(userId);
    return null;
  }

  // Tope de memoria: pasado, se vacía entero. Sólo cuesta una consulta más por
  // persona activa en el request siguiente.
  if (cache.size >= MAX_ENTRIES) cache.clear();
  const version = user.tokenVersion ?? 0;
  cache.set(userId, { version, at: now });
  return version;
}

/** Quien acaba de subir la versión llama a esto para que el cambio rija ya. */
export function forgetTokenVersion(userId: string): void {
  cache.delete(userId);
}

/** Sólo para tests. */
export function clearTokenVersionCache(): void {
  cache.clear();
}
