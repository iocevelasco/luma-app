import { useState, useEffect, useCallback, useRef } from 'react';
import { hasNewBuild, parseBuildInfo, type BuildInfo } from '@/lib/build-info';

// `VITE_APP_VERSION` está declarada opcional en vite-env.d.ts y sólo la inyecta
// vite.config al compilar. Sin ella no hay con qué comparar: el hook se apaga
// en lugar de reportar "hay update" contra `undefined` en cada chequeo.
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION;
const CURRENT_BUILD: BuildInfo | null = CURRENT_VERSION
  ? { version: CURRENT_VERSION, buildTime: import.meta.env.VITE_APP_BUILD_TIME ?? null }
  : null;
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
async function fetchServerBuild(signal: AbortSignal): Promise<BuildInfo | null> {
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

  // El content-type puede mentir; `parseBuildInfo` parsea bajo try.
  return parseBuildInfo(await response.text());
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
    if (!CURRENT_BUILD || inFlightRef.current) return;
    inFlightRef.current = true;
    setState(prev => ({ ...prev, isChecking: true }));

    // AbortController y no AbortSignal.timeout(): el helper recién llegó a
    // Safari 16 y sigue faltando en WebViews viejas de iOS.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const serverBuild = await fetchServerBuild(controller.signal);
      if (!mountedRef.current) return;

      // `null` = no se pudo leer la versión (dev, deploy a medias, red caída).
      // No es un update: no hay nada que avisarle al usuario.
      if (serverBuild === null) {
        setState(prev => ({ ...prev, lastChecked: new Date() }));
        return;
      }

      const hasUpdate = hasNewBuild(CURRENT_BUILD, serverBuild);
      setState(prev => ({
        ...prev,
        hasUpdate,
        newVersion: hasUpdate ? serverBuild.version : null,
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
    if (!CURRENT_BUILD) return;

    // Primera verificación después de 5 segundos (dar tiempo a que cargue la app)
    const initialTimeout = window.setTimeout(checkForUpdate, 5000);

    // Verificaciones periódicas
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL);

    // También verificar cuando la pestaña vuelve a estar visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // El caso que más duele de un deploy: la pestaña vieja pide un chunk con
    // hash que ya no existe y la ruta no carga. Vite avisa con este evento. No
    // se asume "hay update" —puede ser una red caída—: se pregunta al servidor,
    // y el aviso sale sólo si de verdad hay otro build.
    const handlePreloadError = () => void checkForUpdate();
    window.addEventListener('vite:preloadError', handlePreloadError);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vite:preloadError', handlePreloadError);
    };
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    refresh,
    dismissUpdate,
  };
}
