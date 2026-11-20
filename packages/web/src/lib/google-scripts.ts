/**
 * Carga a mano de los scripts de Google, como `stripe-js.ts`: Google exige
 * servirlos desde sus dominios y no hay paquete npm que los reemplace.
 *
 * Los usan el login (`google-identity.ts`) y Drive (`google-drive.ts`). Un
 * script se pide una sola vez aunque lo carguen las dos.
 */

export const GSI_URL = 'https://accounts.google.com/gsi/client';

const loading = new Map<string, Promise<void>>();

/** No cargó (sin red, bloqueado por una extensión, la CSP). */
export class GoogleScriptError extends Error {
  constructor(url: string) {
    super(`No se pudo cargar ${url}`);
    this.name = 'GoogleScriptError';
  }
}

export function loadGoogleScript(url: string, isReady: () => boolean): Promise<void> {
  if (isReady()) return Promise.resolve();
  const pending = loading.get(url);
  if (pending) return pending;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => (isReady() ? resolve() : reject(new GoogleScriptError(url)));
    script.onerror = () => reject(new GoogleScriptError(url));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Que el próximo intento pruebe de nuevo (p. ej. volvió la conexión).
    loading.delete(url);
    document.querySelector(`script[src="${url}"]`)?.remove();
    throw error;
  });
  loading.set(url, promise);
  return promise;
}
