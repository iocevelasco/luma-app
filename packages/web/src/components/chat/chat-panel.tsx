import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ChatConversation } from './chat-conversation';

/**
 * Panel lateral del chat. Al cerrarlo se desmonta la vista, no la
 * conversación: ésta vive en memoria en `useChatStore`.
 */
export function ChatPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-border px-4 py-3">
          <SheetTitle>{t('secureChat.title')}</SheetTitle>
          <SheetDescription>{t('secureChat.prototypeNote')}</SheetDescription>
        </div>
        <div className="min-h-0 flex-1">
          <ChatConversation />
        </div>
      </SheetContent>
    </Sheet>
  );
}
