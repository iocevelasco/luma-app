import { useState } from 'react';
import { History, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChatPanel } from '@/components/chat/chat-panel';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { restoreMockHistory } from '@/lib/chat/chat-store';

/**
 * Prototipo del chat con datos simulados: sin red, sin claves, sin
 * persistencia. Sirve para ver los controles de seguridad funcionando
 * (`docs/CHAT-SEGURIDAD.md`).
 */
export function ChatPrototypePage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const examples = t('secureChat.examples', { returnObjects: true }) as string[];

  return (
    <>
      <PageLayout
        width="narrow"
        action={
          <Button onClick={() => setOpen(true)}>
            <MessageSquare aria-hidden />
            {t('secureChat.open')}
          </Button>
        }
        secondaryActions={
          <Button variant="outline" onClick={() => { restoreMockHistory(); setOpen(true); }}>
            <History aria-hidden />
            {t('secureChat.loadHistory')}
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">{t('secureChat.description')}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          {examples.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </PageLayout>
      <ChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
