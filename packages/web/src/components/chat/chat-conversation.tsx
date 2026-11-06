import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Check, CheckCheck, Copy, ImagePlus, Paperclip, RotateCcw, SendHorizontal, Square, User, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useChatStore, type ChatStoreHook } from '@/lib/chat/chat-store';
import { useTypewriter } from '@/lib/chat/use-typewriter';
import { ALLOWED_IMAGE_TYPES, CHAT_LIMITS } from '@/lib/chat/limits';
import type { ChatMessage } from '@/lib/chat/types';
import { clampTitle } from '@/lib/chat/content';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './chat-markdown';
import { SafeImage } from './safe-image';

/** Saludo y frases para arrancar, ya traducidos: el componente no sabe de i18n ni de usuarios. */
export interface ChatWelcome {
  title: string;
  subtitle: string;
  starters: { id: string; icon: LucideIcon; text: string }[];
}

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

/**
 * Copia el texto **tal como llegó** (Markdown crudo), no el HTML renderizado:
 * no se lee el DOM ni se escribe HTML en el portapapeles. La API del
 * portapapeles no está en todos los contextos (HTTP, algunos WebViews): se
 * detecta y, si falta, se avisa en lugar de fallar en silencio.
 */
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const id = window.setTimeout(() => setState('idle'), 2000);
    return () => window.clearTimeout(id);
  }, [state]);

  async function copy() {
    try {
      if (typeof window.navigator.clipboard?.writeText !== 'function') throw new Error('no-clipboard');
      await window.navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Button type="button" variant="ghost" size="icon" className="size-6" onClick={copy} aria-label={t('secureChat.copy')}>
        {state === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
      </Button>
      <span role="status" className="text-2xs">
        {state === 'copied' && t('secureChat.copied')}
        {state === 'failed' && t('secureChat.copyFailed')}
      </span>
    </span>
  );
}

function formatTime(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
}

/** Quién habla, arriba de la burbuja de la persona. El asistente no lleva avatar ni nombre. */
function Sender() {
  const { t } = useTranslation();
  return (
    <div className="mb-1 flex flex-row-reverse items-center gap-2 text-xs text-muted-foreground">
      <Avatar className="size-6">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <User className="size-3.5" aria-hidden />
        </AvatarFallback>
      </Avatar>
      <span>{t('secureChat.you')}</span>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const mine = message.role === 'user';
  const time = formatTime(message.createdAt);
  const streaming = message.status === 'streaming';
  return (
    <li className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {mine && <Sender />}
      <div
        data-testid={`message-${message.role}`}
        aria-busy={streaming}
        className={cn(
          'space-y-2 text-sm',
          mine ? 'max-w-[88%] rounded-xl border border-transparent bg-primary px-4 py-3 text-primary-foreground' : 'w-full text-foreground',
        )}
      >
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
        <div className={cn('flex items-center gap-1.5 text-2xs', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {streaming ? (
            <span>{t('secureChat.streaming')}</span>
          ) : (
            <>
              {time && <time dateTime={new Date(message.createdAt).toISOString()}>{time}</time>}
              {mine && <CheckCheck className="size-3.5" aria-label={t('secureChat.sent')} />}
              {!mine && message.content && <CopyButton text={message.content} />}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * El contenido del chat, sin el contenedor: así vive igual en un panel lateral
 * que en una página. El estado está en el store, no acá, por eso cerrar el
 * panel no pierde la conversación. Sin `store` usa el del prototipo.
 */
export function ChatConversation({
  store: useStore = useChatStore,
  typedPlaceholder,
  welcome,
}: {
  store?: ChatStoreHook;
  /** Si viene, el placeholder se escribe letra por letra en vez de ser fijo. */
  typedPlaceholder?: string;
  /** Si viene, la conversación vacía saluda y ofrece iniciadores en vez del aviso genérico. */
  welcome?: ChatWelcome;
}) {
  const { t } = useTranslation();
  const store = useStore();
  const typed = useTypewriter(typedPlaceholder ?? '', Boolean(typedPlaceholder));
  const placeholder = typedPlaceholder ? `${typed.visible}${typed.typing ? '|' : ''}` : t('secureChat.inputPlaceholder');
  const attachments = store.capabilities.attachments;
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);
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

  const busy = store.isStreaming || store.isAttaching;
  // Sin texto ni imagen no hay nada que enviar: el botón queda apagado y Enter no hace nada.
  const empty = draft.trim() === '' && store.draftAttachments.length === 0;

  async function submit() {
    if (busy || empty) return;
    const text = draft;
    // Se limpia sólo si el envío es válido; si no, la persona conserva lo escrito.
    const trimmed = text.trim();
    const valid = (trimmed || store.draftAttachments.length > 0) && trimmed.length <= CHAT_LIMITS.maxUserChars && !store.isStreaming;
    if (valid) setDraft('');
    await store.send(text);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  /** Enter envía; Shift+Enter hace un salto de línea. Mientras un IME compone, Enter es suyo. */
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  }

  /** Pegar una imagen la adjunta (pasa por la misma validación). El texto pegado sigue su camino normal. */
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!attachments || files.length === 0) return;
    e.preventDefault();
    void store.addFiles(files);
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  function onDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    // Siempre se frena: un archivo soltado fuera de un destino navega a él y tira la app.
    e.preventDefault();
    if (attachments) setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    // Sólo archivos: texto o URLs arrastrados desde otra página se ignoran.
    if (attachments) void store.addFiles(Array.from(e.dataTransfer.files));
  }

  const title = clampTitle(store.title);

  return (
    <div
      data-testid="chat-conversation"
      className="relative flex h-full min-h-0 flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div
          data-testid="drop-overlay"
          className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-background/90 text-sm"
        >
          {t('secureChat.dropHere')}
        </div>
      )}
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
        {store.messages.length === 0 && welcome ? (
          <div data-testid="chat-welcome" className="flex min-h-full flex-col justify-center gap-6 py-6">
            <div className="space-y-1">
              <p className="text-xl text-foreground">{welcome.title}</p>
              <p className="text-sm text-muted-foreground">{welcome.subtitle}</p>
            </div>
            <ul className="m-0 grid list-none gap-2 p-0">
              {welcome.starters.map(({ id, icon: Icon, text }) => (
                <li key={id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-start whitespace-normal py-3 text-start"
                    disabled={busy}
                    onClick={() => void store.send(text)}
                  >
                    <Icon aria-hidden className="text-primary" />
                    {text}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : store.messages.length === 0 ? (
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

        {/* Sin acciones de adjuntar el campo es de una sola fila: texto y enviar en la misma línea. */}
        <div
          className={cn(
            'rounded-2xl bg-card shadow-surface ring-1 ring-border focus-within:ring-2 focus-within:ring-ring/50',
            attachments ? 'flex flex-col gap-2 px-4 pb-2 pt-3' : 'flex items-end gap-2 py-2 pe-2 ps-4',
          )}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            aria-label={t('secureChat.inputLabel')}
            aria-describedby="chat-input-hint"
            placeholder={placeholder}
            rows={attachments ? 2 : 1}
            // Límite duro del control; el store lo vuelve a comprobar.
            maxLength={CHAT_LIMITS.maxUserChars}
            className={cn(
              'field-sizing-content max-h-40 w-full resize-none bg-transparent text-base text-foreground outline-none placeholder:text-foreground/40 md:text-sm',
              attachments ? 'min-h-12' : 'min-h-9 flex-1 py-[7px]',
            )}
          />
          <div className={cn('flex items-center gap-2', attachments ? 'justify-between' : 'shrink-0')}>
            {attachments && (
              <div className="flex items-center gap-1">
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
                {/* Los dos abren el mismo selector: sólo se aceptan imágenes. */}
                <Button type="button" variant="ghost" size="icon" aria-label={t('secureChat.attach')} onClick={() => fileRef.current?.click()}>
                  <ImagePlus aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={t('secureChat.attachFile')} onClick={() => fileRef.current?.click()}>
                  <Paperclip aria-hidden />
                </Button>
              </div>
            )}
            <div className="ms-auto flex items-center gap-1">
              {store.isStreaming && (
                <Button type="button" variant="ghost" size="icon" aria-label={t('secureChat.stop')} onClick={store.stop}>
                  <Square aria-hidden />
                </Button>
              )}
              {/* Plano a propósito (sin relieve) y apagado mientras se envía o se valida un adjunto. */}
              <Button
                type="submit"
                size="icon"
                className="border-transparent shadow-none active:shadow-none"
                aria-label={t('secureChat.send')}
                disabled={busy || empty}
              >
                <SendHorizontal aria-hidden />
              </Button>
            </div>
          </div>
        </div>
        <span id="chat-input-hint" className="sr-only">
          {t('secureChat.inputHint')}
        </span>
        {draft.length > CHAT_LIMITS.maxUserChars * 0.8 && (
          <p className="text-right text-2xs text-muted-foreground">
            {draft.length}/{CHAT_LIMITS.maxUserChars}
          </p>
        )}
      </form>
    </div>
  );
}
