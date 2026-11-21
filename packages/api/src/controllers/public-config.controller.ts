import type { Request, Response } from 'express';
import type { PublicConfig } from '@luma/shared';
import { GOOGLE_CONFIG } from '../config/app.config.js';

/**
 * Lo que las pantallas públicas necesitan antes de entrar: sólo el client id
 * del botón de Google, que no es secreto (está en el HTML del botón). Nada
 * más sale sin sesión.
 */
export function publicConfigFromEnv(google = GOOGLE_CONFIG): PublicConfig {
  return {
    googleLogin: google.LOGIN_ENABLED ? { clientId: google.CLIENT_ID! } : null,
  };
}

export function getPublicConfig(_req: Request, res: Response) {
  // No cambia sin un redeploy: unos minutos de caché ahorran un request por pestaña.
  res.set('Cache-Control', 'public, max-age=300');
  return res.json({ success: true, data: publicConfigFromEnv() });
}
