import { useEffect, useRef } from 'react';

/**
 * En local el widget corre en el puerto 3000. En producción `VITE_NEXUSBOT_URL`
 * se hornea en el build (Coolify): el navegador no puede pedir localhost.
 */
const NEXUSBOT_URL = (import.meta.env.VITE_NEXUSBOT_URL || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const WIDGET_SRC = `${NEXUSBOT_URL}/widget/nexus-chat.js`;

/**
 * El script no va en `index.html`: login y el resto de pantallas públicas no
 * deben pedir el widget. En CI no hay nada en el puerto 3000 y el navegador
 * lo anotaría como error de consola.
 */
function loadWidget() {
  if (customElements.get('nexus-chat')) return Promise.resolve();
  const found = document.querySelector<HTMLScriptElement>('script[data-nexus-widget]');
  if (found) {
    return new Promise<void>((resolve, reject) => {
      found.addEventListener('load', () => resolve(), { once: true });
      found.addEventListener('error', () => reject(new Error('widget')), { once: true });
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.dataset.nexusWidget = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('widget'));
    document.head.appendChild(script);
  });
}

/**
 * El botón del chat vive en el layout: al cambiar de sección el panel no se
 * desmonta, y el widget tampoco. La sesión la pide Luma; los mensajes van
 * directo a NexusBot (`api-url`). La esquina la ocupa la acción principal;
 * el despegue del chat está en `index.css` (`--nexus-inset-*`).
 */
export function NexusChat() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node = el;
    let cancelled = false;

    async function connect() {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (cancelled) return;
      node.setAttribute('api-url', NEXUSBOT_URL);
      node.setAttribute('session-token', data.sessionToken);
      node.setAttribute('title', 'Luma');
    }

    el.addEventListener('nexus:token-expired', connect);
    loadWidget()
      .then(() => {
        if (!cancelled) void connect();
      })
      .catch(() => {
        // Sin el script el panel sigue usable; el botón del chat no aparece.
      });
    return () => {
      cancelled = true;
      el.removeEventListener('nexus:token-expired', connect);
    };
  }, []);

  return <nexus-chat ref={ref} primary-color="#00d992" title="Luma" />;
}
