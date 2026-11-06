/**
 * Dónde está NexusBot. En local corre en el puerto 3000; en producción
 * `VITE_NEXUSBOT_URL` se hornea en el build (Coolify), porque el navegador no
 * puede pedir `localhost`. No es un secreto: es una URL pública. La clave de
 * NexusBot vive sólo en la API de Luma.
 */
export const NEXUSBOT_URL = (import.meta.env.VITE_NEXUSBOT_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
