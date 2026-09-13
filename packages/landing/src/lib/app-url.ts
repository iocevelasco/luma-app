/**
 * URL de la aplicación. Se hornea en build time (`VITE_APP_URL`) porque la
 * landing es estática: en producción apunta al subpath `/app`, donde la API
 * monta la SPA.
 */
export const APP_URL = (import.meta.env.VITE_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');

export const LOGIN_URL = `${APP_URL}/login`;
export const REGISTER_URL = `${APP_URL}/register`;
