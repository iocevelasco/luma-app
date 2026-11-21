import type { Request, Response } from 'express';
import type { IntegrationsConfig, PublicConfig } from '@luma/shared';
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

/** Las claves de navegador de Maps y Drive: sólo para quien tiene sesión. */
export function integrationsConfigFromEnv(google = GOOGLE_CONFIG): IntegrationsConfig {
  return {
    maps: google.MAPS_BROWSER_KEY ? { apiKey: google.MAPS_BROWSER_KEY } : null,
    drive: google.DRIVE_ENABLED
      ? {
          clientId: google.CLIENT_ID!,
          apiKey: google.PICKER_API_KEY!,
          appId: google.PROJECT_NUMBER!,
        }
      : null,
  };
}

export function getPublicConfig(_req: Request, res: Response) {
  // No cambia sin un redeploy: unos minutos de caché ahorran un request por pestaña.
  res.set('Cache-Control', 'public, max-age=300');
  return res.json({ success: true, data: publicConfigFromEnv() });
}

/** Requiere `isAuthenticated`. Caché privada: no la guarda ningún proxy. */
export function getIntegrationsConfig(_req: Request, res: Response) {
  res.set('Cache-Control', 'private, max-age=300');
  return res.json({ success: true, data: integrationsConfigFromEnv() });
}
