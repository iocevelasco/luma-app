import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '@luma/shared';
import { Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useAdvisorChat } from '@/hooks/advisor/use-advisor-chat';
import { useProject } from '@/hooks/projects/use-project-queries';
import { isApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <p
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {message.content}
      </p>
    </div>
  );
}

/**
 * Consultor IA: chat de preguntas y respuestas sobre UNA obra puntual, sólo
 * para el dueño (mismo gate que presupuesto — ver routes/advisor.ts del lado
 * del server). El historial no se persiste: vive acá, en el estado del
 * componente, y se pierde al recargar la página.
 */
export function ProjectAdvisorPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData, isLoading, isError } = useProject(projectId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const sendMessage = useAdvisorChat(projectId ?? '');

  if (isError) return <RouteError />;
  if (isLoading || !projectData) return <RouteLoading />;

  const notConfigured = isApiError(sendMessage.error) && sendMessage.error.status === 503;

  function sendCurrentMessage() {
    const trimmed = input.trim();
    if (!trimmed || sendMessage.isPending) return;

    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');

    sendMessage.mutate(
      { message: trimmed, history },
      {
        onSuccess: ({ reply }) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        },
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendCurrentMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendCurrentMessage();
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3 md:p-4">
      <div>
        <h1 className="text-2xl">{t('advisor.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('advisor.subtitle', { name: projectData.project.name })}
        </p>
      </div>

      <Card className="flex flex-col gap-0 overflow-hidden py-0">
        <ScrollArea className="h-[50vh]">
          <div className="flex flex-col gap-3 p-4">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('advisor.empty')}
              </p>
            ) : (
              messages.map((message, index) => <ChatBubble key={index} message={message} />)
            )}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('advisor.thinking')}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <CardContent className="border-t border-border py-3">
          {notConfigured && (
            <p className="mb-2 text-sm text-destructive">{t('advisor.notConfigured')}</p>
          )}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('advisor.placeholder')}
              rows={2}
              disabled={sendMessage.isPending}
              className="resize-none"
            />
            <Button type="submit" disabled={!input.trim() || sendMessage.isPending}>
              {sendMessage.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectAdvisorPage;
