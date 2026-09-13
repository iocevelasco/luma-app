import { SERVER_CONFIG } from '../config/app.config.js';

/**
 * Builds a full URL pointing to the frontend SPA.
 *
 * Uses APP_URL (which may include a subpath like /app) so that
 * links in emails and server-side redirects always resolve correctly
 * regardless of how the SPA is mounted.
 *
 * Local dev:   http://localhost:5173/verify-email?token=...
 * Production:  https://<DOMINIO>/app/verify-email?token=...
 */
export function appUrl(path: string): string {
  const base = SERVER_CONFIG.APP_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
