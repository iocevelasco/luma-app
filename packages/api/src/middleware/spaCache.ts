import { basename } from 'node:path';
import type { Response } from 'express';

/**
 * Política de cache de la SPA compilada.
 *
 * Es la mitad servidor del mecanismo de actualización: el cliente le pregunta a
 * `version.json` si hay un deploy nuevo, y esa respuesta —igual que el
 * `index.html` que apunta a los bundles— no puede quedar retenida en ningún
 * lado. Los bundles con hash, en cambio, pueden cachearse para siempre: un
 * deploy nuevo los llama distinto.
 *
 * Los tres valores dependen entre sí. Si `index.html` se pudiera cachear, el
 * `immutable` de los assets dejaría a la gente apuntando a bundles viejos.
 */
export const CACHE_REVALIDATE = 'no-cache';
export const CACHE_NEVER = 'no-store';
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';

// `index-BwQ3kz9a.js`, `index-D8f2Lm1x.css`, `index-BwQ3kz9a.js.map`: nombre,
// guion, hash de 8 caracteres de Vite, extensión. Un archivo de `public/` que
// caiga en `assets/` sin hash no matchea y queda con la política por defecto.
const HASHED_ASSET = /-[\w-]{8}\.[\w.]+$/;

/** Cache-Control para un archivo de la SPA, o `null` si le toca el default de express. */
export function spaCacheControl(filePath: string): string | null {
  const name = basename(filePath);
  if (name === 'version.json') return CACHE_NEVER;
  if (name === 'index.html') return CACHE_REVALIDATE;

  const inAssets = filePath.split(/[\\/]/).includes('assets');
  if (inAssets && HASHED_ASSET.test(name)) return CACHE_IMMUTABLE;

  return null;
}

/** `setHeaders` para `express.static`. */
export function setSpaCacheHeaders(res: Response, filePath: string): void {
  const value = spaCacheControl(filePath);
  if (value) res.setHeader('Cache-Control', value);
}
