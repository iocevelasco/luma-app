import { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useOpenChatSession } from '@/hooks/chat/use-chat-queries';
import { createChatStore } from '@/lib/chat/chat-store';
import { NEXUSBOT_URL } from '@/lib/chat/config';
import { createNexusTransport } from '@/lib/chat/nexus-transport';
import { ChatPanel } from './chat-panel';

/**
 * El chat de Luma conectado a NexusBot: botón flotante + panel.
 *
 * El store nace con este componente (el layout del panel no se desmonta al
 * cambiar de sección), así que cerrar el panel conserva la conversación y
 * cerrar sesión la borra. Es un store propio: no comparte nada con el
 * prototipo de datos simulados.
 *
 * Sin adjuntos: NexusBot sólo recibe texto. Cuando acepte imágenes, es un
 * cambio de `capabilities` acá y nada más.
 */
export function LiveChat() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const session = useOpenChatSession();

  // `mutateAsync` cambia de identidad entre renders; el transporte lee siempre la última.
  const openSession = useRef(session.mutateAsync);
  openSession.current = session.mutateAsync;

  const [store] = useState(() =>
    createChatStore({
      transport: createNexusTransport({
        apiUrl: NEXUSBOT_URL,
        openSession: (conversationId) => openSession.current(conversationId),
      }),
      capabilities: { attachments: false },
    }),
  );

  // Al salir del panel (cerrar sesión) no queda nada de la conversación en memoria.
  useEffect(() => () => store.getState().reset(), [store]);

  return (
    <>
      <Button
        type="button"
        size="icon-lg"
        aria-label={t('secureChat.open')}
        onClick={() => setOpen(true)}
        // Misma esquina que la acción principal, un escalón arriba (ver `PageLayout`).
        className="fixed end-4 bottom-[calc(5rem+2.25rem+0.75rem+env(safe-area-inset-bottom))] z-40 md:end-8 md:bottom-[calc(2rem+2.25rem+0.75rem)]"
      >
        <Bot aria-hidden />
      </Button>
      <ChatPanel
        open={open}
        onOpenChange={setOpen}
        store={store}
        title={t('secureChat.liveTitle')}
        typedPlaceholder={t('secureChat.liveDescription')}
      />
    </>
  );
}
