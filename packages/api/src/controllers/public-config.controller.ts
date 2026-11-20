import type { Request, Response } from 'express';
import type { PublicConfig } from '@luma/shared';
import { GOOGLE_CONFIG } from '../config/app.config.js';

/** Lo que la SPA necesita saber del entorno. Sin sesión: lo usan también las pantallas públicas. */
export function publicConfigFromEnv(google = GOOGLE_CONFIG): PublicConfig {
  return {
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
