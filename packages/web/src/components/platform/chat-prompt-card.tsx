import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormShell } from '@/components/common/form-shell';
import { errorMessage } from '@/lib/error-message';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useChatPrompt, useSaveChatPrompt } from '@/hooks/platform/use-chat-prompt';

/**
 * El prompt del asistente, en Configuración. Sólo lo monta la página si quien
 * entra es admin de plataforma: es un texto para todos, no de una Empresa.
 */
export function ChatPromptCard() {
  const { t } = useTranslation();
  const prompt = useChatPrompt();
  const save = useSaveChatPrompt();
  const [draft, setDraft] = useState<string | null>(null);

  const saved = prompt.data?.systemPrompt ?? '';
  const value = draft ?? saved;
  // El texto por defecto todavía no está en NexusBot: se puede guardar tal cual.
  const unpublished = prompt.isSuccess && prompt.data?.updatedAt == null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.chat.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('settings.chat.hint')}</p>
      </CardHeader>
      <CardContent>
        {prompt.isLoading ? (
          <LoadingIndicator />
        ) : prompt.isError ? (
          <p className="text-sm text-destructive">{errorMessage(prompt.error, t) || t('settings.chat.loadError')}</p>
        ) : (
          <FormShell
            variant="embedded"
            className="gap-4"
            submitLabel={t('settings.chat.save')}
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(value, { onSuccess: () => setDraft(null) });
            }}
            isSubmitting={save.isPending}
            isDirty={unpublished || value.trim() !== saved}
            error={save.error}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="chat-system-prompt">{t('settings.chat.label')}</Label>
              <Textarea
                id="chat-system-prompt"
                className="min-h-64"
                value={value}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
          </FormShell>
        )}
      </CardContent>
    </Card>
  );
}
