import type { NextFunction, Request, Response } from 'express';
import type { IntegrationsConfig } from '@luma/shared';
import { GOOGLE_CONFIG } from '../config/app.config.js';
import { unauthenticated } from '../utils/errors.js';

/**
 * Las claves de navegador de Maps y Drive: sólo para quien tiene sesión
 * (`GET /api/config/integrations`). Aparte del controller público a propósito,
 * y con su propio chequeo de sesión: si alguien lo montara en un router sin
 * `isAuthenticated`, igual no las entrega.
 *
 * Pedir sesión no las vuelve secretas (el registro es abierto, y la de Maps va
 * en el iframe del mapa): lo que las protege es la restricción por dominio y
 * por API, y la cuota, en Google Cloud. Ver `docs/DEPLOY.md`.
 */
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

/** Requiere `isAuthenticated`. Caché privada: no la guarda ningún proxy. */
export function getIntegrationsConfig(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next(unauthenticated());
  res.set('Cache-Control', 'private, max-age=300');
  return res.json({ success: true, data: integrationsConfigFromEnv() });
}
