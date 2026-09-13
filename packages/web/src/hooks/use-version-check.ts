import { useState, useEffect, useCallback, useRef } from 'react';

// `VITE_APP_VERSION` está declarada opcional en vite-env.d.ts y sólo la inyecta
// vite.config al compilar. Sin ella no hay con qué comparar: el hook se apaga
// en lugar de reportar "hay update" contra `undefined` en cada chequeo.
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION;
const CHECK_INTERVAL = 60 * 1000; // Verificar cada 60 segundos
const REQUEST_TIMEOUT = 10 * 1000;

interface VersionCheckState {
  hasUpdate: boolean;
  currentVersion: string;
  newVersion: string | null;
  isChecking: boolean;
  lastChecked: Date | null;
}

/**
 * `version.json` lo genera vite.config recién en el build (`writeBundle`), así que
 * en dev el archivo no existe y el fallback SPA responde `index.html` con 200 OK.
 * Es decir: `response.ok` no alcanza para saber que esto es JSON, y `.json()`
 * sobre el HTML tira SyntaxError en los tres motores —Safari lo redacta como
 * "The string did not match the expected pattern"—. Por eso se valida el
 * content-type y se parsea a mano.
 */
async function fetchServerVersion(signal: AbortSignal): Promise<string | null> {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  // Timestamp + no-store: sin esto el propio version.json se sirve cacheado y
  // la app nunca se entera de que hay una versión nueva.
  const response = await fetch(`${base}version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    signal,
  });

  if (!response.ok) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return null;

  // El content-type puede mentir; parsear igual bajo try.
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    return null;
  }

  const version = (data as { version?: unknown } | null)?.version;
  return typeof version === 'string' && version.length > 0 ? version : null;
}

export function useVersionCheck() {
  const [state, setState] = useState<VersionCheckState>({
    hasUpdate: false,
    currentVersion: CURRENT_VERSION ?? 'unknown',
    newVersion: null,
    isChecking: false,
    lastChecked: null,
  });

  // Un solo chequeo a la vez: el intervalo y el visibilitychange pueden
  // dispararse juntos al volver a la pestaña.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const checkForUpdate = useCallback(async () => {
    if (!CURRENT_VERSION || inFlightRef.current) return;
    inFlightRef.current = true;
    setState(prev => ({ ...prev, isChecking: true }));

    // AbortController y no AbortSignal.timeout(): el helper recién llegó a
    // Safari 16 y sigue faltando en WebViews viejas de iOS.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const serverVersion = await fetchServerVersion(controller.signal);
      if (!mountedRef.current) return;

      // `null` = no se pudo leer la versión (dev, deploy a medias, red caída).
      // No es un update: no hay nada que avisarle al usuario.
      if (serverVersion === null) {
        setState(prev => ({ ...prev, lastChecked: new Date() }));
        return;
      }

      const hasUpdate = serverVersion !== CURRENT_VERSION;
      setState(prev => ({
        ...prev,
        hasUpdate,
        newVersion: hasUpdate ? serverVersion : null,
        lastChecked: new Date(),
      }));
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.warn('No se pudo verificar si hay una versión nueva:', error);
      }
    } finally {
      window.clearTimeout(timeoutId);
      inFlightRef.current = false;
      // En el `finally`: antes el early return de `!response.ok` dejaba
      // `isChecking` en true para siempre.
      if (mountedRef.current) setState(prev => ({ ...prev, isChecking: false }));
    }
  }, []);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, hasUpdate: false }));
  }, []);

  // Verificar al montar y luego periódicamente
  useEffect(() => {
    mountedRef.current = true;
    if (!CURRENT_VERSION) return;

    // Primera verificación después de 5 segundos (dar tiempo a que cargue la app)
    const initialTimeout = window.setTimeout(checkForUpdate, 5000);

    // Verificaciones periódicas
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL);

    // También verificar cuando la pestaña vuelve a estar visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    refresh,
    dismissUpdate,
  };
}
