import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Paperclip, RotateCcw, Send, Square, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatStore } from '@/lib/chat/chat-store';
import { ALLOWED_IMAGE_TYPES, CHAT_LIMITS } from '@/lib/chat/limits';
import type { ChatMessage } from '@/lib/chat/types';
import { clampTitle } from '@/lib/chat/content';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './chat-markdown';
import { SafeImage } from './safe-image';

/** Los códigos son kebab-case; las claves i18n, camelCase. */
const camel = (code: string) => code.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

function AttachmentThumb({ name, previewUrl, zoomable }: { name: string; previewUrl: string; zoomable?: boolean }) {
  return (
    <figure className="m-0 flex max-w-40 flex-col gap-1">
      <SafeImage src={previewUrl} kind="local-preview" alt={name} zoomable={zoomable} className="max-h-28" />
      {/* El nombre es texto: React lo escapa y `break-all` evita que ensanche la burbuja. */}
      <figcaption className="break-all text-2xs text-muted-foreground">{name}</figcaption>
    </figure>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const mine = message.role === 'user';
  return (
    <li className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        data-testid={`message-${message.role}`}
        aria-busy={message.status === 'streaming'}
        className={cn(
          'max-w-[85%] space-y-2 rounded-md px-3 py-2 text-sm',
          mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        <span className="sr-only">{t(mine ? 'secureChat.you' : 'secureChat.assistant')}</span>
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <AttachmentThumb key={a.id} name={a.name} previewUrl={a.previewUrl} zoomable />
            ))}
          </div>
        )}
        {mine ? (
          // Texto de la persona: nunca Markdown, siempre texto plano.
          message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : message.status === 'error' && !message.content ? (
          <p className="text-destructive">{t('secureChat.errors.stream')}</p>
        ) : (
          <ChatMarkdown text={message.content} maxChars={CHAT_LIMITS.maxAssistantChars} />
        )}
        {message.status === 'streaming' && (
          <p className="text-2xs text-muted-foreground">{t('secureChat.streaming')}</p>
        )}
      </div>
    </li>
  );
}

/**
 * El contenido del chat, sin el contenedor: así vive igual en un panel lateral
 * que en una página. El estado está en `useChatStore`, no acá, por eso cerrar
 * el panel no pierde la conversación.
 */
export function ChatConversation() {
  const { t } = useTranslation();
  const store = useChatStore();
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // `scrollIntoView` falta en algunos entornos: se detecta, no se asume.
    if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ block: 'end' });
  }, [store.messages]);

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length) await store.addFiles(files);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft;
    // Se limpia sólo si el envío es válido; si no, la persona conserva lo escrito.
    const trimmed = text.trim();
    const valid = (trimmed || store.draftAttachments.length > 0) && trimmed.length <= CHAT_LIMITS.maxUserChars && !store.isStreaming;
    if (valid) setDraft('');
    await store.send(text);
  }

  const title = clampTitle(store.title);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="min-w-0 break-words text-sm text-muted-foreground">{title || t('secureChat.newTitle')}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { store.reset(); setDraft(''); }}>
          <RotateCcw aria-hidden />
          {t('secureChat.newConversation')}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {store.discarded > 0 && (
          <Alert className="mb-3" data-testid="restore-notice">
            <AlertDescription>{t('secureChat.restoredDiscarded', { count: store.discarded })}</AlertDescription>
          </Alert>
        )}
        {store.messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm">{t('secureChat.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('secureChat.emptyHint')}</p>
          </div>
        ) : (
          <ol role="log" aria-live="polite" aria-label={t('secureChat.logLabel')} className="m-0 flex list-none flex-col gap-3 p-0">
            {store.messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="space-y-2 border-t border-border p-3">
        {(store.error || store.rejected.length > 0) && (
          <Alert variant="destructive" role="alert" data-testid="chat-notices">
            <AlertDescription>
              <ul className="m-0 list-none space-y-1 p-0">
                {store.error && <li>{t(`secureChat.errors.${camel(store.error)}`)}</li>}
                {store.rejected.map((r, i) => (
                  <li key={`${r.name}-${i}`}>
                    {/* `r.name` es texto de un archivo ajeno: sólo se interpola como texto. */}
                    {t(`secureChat.rejections.${camel(r.reason)}`, { name: r.name })}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {store.draftAttachments.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {store.draftAttachments.map((a) => (
              <li key={a.id} className="relative">
                <AttachmentThumb name={a.name} previewUrl={a.previewUrl} />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -right-2 -top-2 size-6"
                  aria-label={t('secureChat.removeAttachment', { name: a.name })}
                  onClick={() => store.removeDraftAttachment(a.id)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={t('secureChat.inputLabel')}
          placeholder={t('secureChat.inputPlaceholder')}
          rows={2}
          // Límite duro del control; el store lo vuelve a comprobar.
          maxLength={CHAT_LIMITS.maxUserChars}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              // Sólo orienta al selector del sistema; la validación real está en `validateAttachments`.
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              className="hidden"
              data-testid="file-input"
              onChange={onFiles}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip aria-hidden />
              {t('secureChat.attach')}
            </Button>
            <span className="text-2xs text-muted-foreground">{draft.length}/{CHAT_LIMITS.maxUserChars}</span>
          </div>
          {store.isStreaming ? (
            <Button type="button" variant="outline" size="sm" onClick={store.stop}>
              <Square aria-hidden />
              {t('secureChat.stop')}
            </Button>
          ) : (
            <Button type="submit" size="sm">
              <Send aria-hidden />
              {t('secureChat.send')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
