import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { chatApi } from '@/api/chat';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/** El prompt del asistente. Sólo lo pide un admin de plataforma. */
export function useChatPrompt() {
  const { isAuthenticated, user } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.chatPrompt],
    queryFn: () => chatApi.prompt(),
    enabled: isAuthenticated && isAdmin(user?.role),
  });
}

export function useSaveChatPrompt() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (systemPrompt: string) => chatApi.savePrompt(systemPrompt),
    onSuccess: (prompt) => {
      queryClient.setQueryData([QueryKeys.chatPrompt], prompt);
      toast.success(t('settings.chat.saved'));
    },
  });
}
