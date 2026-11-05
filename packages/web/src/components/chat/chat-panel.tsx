import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { ChatStoreHook } from '@/lib/chat/chat-store';
import { cn } from '@/lib/utils';
import { ChatConversation } from './chat-conversation';

/**
 * Panel lateral del chat. Al cerrarlo se desmonta la vista, no la
 * conversación: ésta vive en memoria en el store.
 */
export function ChatPanel({
  open,
  onOpenChange,
  store,
  title,
  description,
  typedPlaceholder,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sin store usa el del prototipo (asistente simulado). */
  store?: ChatStoreHook;
  title?: string;
  description?: string;
  /** Si viene, esa frase se escribe como placeholder del campo y en el encabezado queda sólo para lectores de pantalla. */
  typedPlaceholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="surface-light flex w-full flex-col gap-0 bg-background p-0 text-foreground sm:max-w-lg">
        <div className="border-b border-border px-4 py-3">
          <SheetTitle>{title ?? t('secureChat.title')}</SheetTitle>
          <SheetDescription className={cn(typedPlaceholder && 'sr-only')}>
            {typedPlaceholder ?? description ?? t('secureChat.prototypeNote')}
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1">
          <ChatConversation store={store} typedPlaceholder={typedPlaceholder} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
