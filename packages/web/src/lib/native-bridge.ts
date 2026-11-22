/**
 * Puente con la app nativa. `ReactNativeWebView` lo inyecta el WebView;
 * en el navegador no existe y estas llamadas no hacen nada.
 */
export const NATIVE_SESSION_ENDED = 'session-ended';

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

/** La sesión de la web se cerró: la app tiene que volver a su login. */
export function notifyNativeSessionEnded(): void {
  const bridge = window.ReactNativeWebView;
  if (!bridge) return;
  bridge.postMessage(JSON.stringify({ type: NATIVE_SESSION_ENDED }));
}
