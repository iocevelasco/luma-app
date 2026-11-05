import { useEffect, useRef, useState } from 'react';
import { Building2, Sparkles, UsersRound, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useOpenChatSession } from '@/hooks/chat/use-chat-queries';
import { createChatStore } from '@/lib/chat/chat-store';
import { NEXUSBOT_URL } from '@/lib/chat/config';
import { createNexusTransport } from '@/lib/chat/nexus-transport';
import { useAuth } from '@/providers/auth-provider';
import type { ChatWelcome } from './chat-conversation';
import { ChatPanel } from './chat-panel';

/** Cuatro cosas que el asistente sabe contestar bien: crear obras, roles, el Consultor IA y la plata. */
const STARTERS = [
  { id: 'createProject', icon: Building2 },
  { id: 'roles', icon: UsersRound },
  { id: 'advisor', icon: Sparkles },
  { id: 'money', icon: Wallet },
] as const;

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
  const { user } = useAuth();
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

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const welcome: ChatWelcome = {
    title: firstName ? t('secureChat.greeting', { name: firstName }) : t('secureChat.greetingAnonymous'),
    subtitle: t('secureChat.greetingHint'),
    starters: STARTERS.map(({ id, icon }) => ({ id, icon, text: t(`secureChat.starters.${id}`) })),
  };

  return (
    <>
      {/* Misma esquina que la acción principal, un escalón arriba (ver `PageLayout`). */}
      <span className="fixed end-4 bottom-[calc(5rem+2.25rem+0.75rem+env(safe-area-inset-bottom))] z-40 md:end-8 md:bottom-[calc(2rem+2.25rem+0.75rem)]">
        {/* El aro se anima una sola vez al cargar la vista, para avisar que hay ayuda. */}
        <span aria-hidden className="ai-attention-ring pointer-events-none absolute inset-0 rounded-md bg-primary" />
        <Button type="button" size="icon-lg" aria-label={t('secureChat.openLive')} onClick={() => setOpen(true)} className="relative">
          <Sparkles aria-hidden className="ai-attention-sparkle fill-current" />
        </Button>
      </span>
      <ChatPanel
        open={open}
        onOpenChange={setOpen}
        store={store}
        title={t('secureChat.liveTitle')}
        typedPlaceholder={t('secureChat.liveDescription')}
        welcome={welcome}
      />
    </>
  );
}
