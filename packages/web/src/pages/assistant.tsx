import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SendIcon } from 'lucide-react';
import type { AssistantMessage } from '@luma/shared';
import { useAskAssistant, useAssistantStatus } from '@/hooks';
import { Button, Card, CardContent, EmptyState, Spinner, Textarea } from '@/components/ui';

/**
 * RF-06 — reemplaza a la integración de WhatsApp que tiene Pantera.
 *
 * Las consultas sugeridas son las del §RF-06, textuales. No son decoración:
 * la barrera del chat vacío es real, y estas siete preguntas son las que el
 * documento dice que el equipo hace todos los días.
 */
const SUGGESTIONS = [
  '¿Qué material falta?',
  '¿Quién está trabajando hoy en la obra?',
  '¿Cómo va el avance?',
  '¿Cómo va el presupuesto?',
  '¿Qué se me está saliendo del presupuesto?',
  '¿Qué imprevistos esperan decisión del cliente?',
];

export function AssistantPage() {
  const { data: status } = useAssistantStatus();
  const ask = useAskAssistant();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ask.isPending]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || ask.isPending) return;
    setError(null);
    setDraft('');

    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: 'user',
        content: message,
        sources: [],
        created_at: new Date().toISOString(),
      },
    ]);

    ask.mutate(
      { message, conversationId },
      {
        onSuccess: (result) => {
          setConversationId(result.conversationId);
          setMessages((current) => [...current, result.message]);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'El asistente no pudo responder'),
      },
    );
  };

  if (status && !status.enabled) {
    return (
      <EmptyState
        title="El asistente no está configurado"
        description="Falta la variable ANTHROPIC_API_KEY en el entorno. El resto de la app funciona igual."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Asistente</h1>
        <p className="text-sm text-muted-foreground">
          Responde sólo con datos registrados en este proyecto. Si el dato no existe, lo dice.
        </p>
      </header>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="h-9 rounded-full border border-border px-3.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Cada respuesta enlaza a la pantalla de origen: el dato tiene
                  que ser verificable, o el asistente es una opinión. */}
              {message.sources.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
                  {message.sources.map((source) => (
                    <Link
                      key={source.link}
                      to={source.link}
                      className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {source.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {ask.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Spinner />
              Consultando los datos del proyecto…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Card className="sticky bottom-20 lg:bottom-0">
        <CardContent className="p-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <Textarea
              className="min-h-11 resize-none"
              rows={1}
              placeholder="Preguntá sobre la obra…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <Button type="submit" size="icon" aria-label="Enviar" disabled={ask.isPending}>
              <SendIcon className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
