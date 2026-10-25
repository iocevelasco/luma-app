import { useEffect, useRef } from 'react';

/**
 * El botón del chat vive en el layout: al cambiar de sección el panel no se
 * desmonta, y el widget tampoco. La sesión la pide Luma; los mensajes van
 * directo a NexusBot (`api-url`).
 */
export function NexusChat() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const node = el;

    async function connect() {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      node.setAttribute('api-url', 'http://localhost:3000');
      node.setAttribute('session-token', data.sessionToken);
      node.setAttribute('title', 'Luma');
    }

    el.addEventListener('nexus:token-expired', connect);
    connect();
    return () => el.removeEventListener('nexus:token-expired', connect);
  }, []);

  return <nexus-chat ref={ref} />;
}
