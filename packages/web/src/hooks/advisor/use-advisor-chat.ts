import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ChatMessage } from '@luma/shared';
import { advisorApi } from '@/api/advisor';
import { isApiError } from '@/lib/api-client';

/**
 * Capa 2: mismo patrón que `use-budget-queries.ts`, pero sin `useQuery` — el
 * historial del chat no se persiste, vive en el estado del componente (ver
 * `pages/projects/project-advisor.tsx`), así que no hay nada que cachear ni
 * invalidar acá.
 */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useAdvisorChat(projectId: string) {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ message, history }: { message: string; history: ChatMessage[] }) =>
      advisorApi.sendMessage(projectId, message, history),
    onError: (error) => toast.error(errorMessage(error, t('advisor.errors.send'))),
  });
}
