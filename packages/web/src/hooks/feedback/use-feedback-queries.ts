import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { feedbackApi } from '@/api/feedback';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2 de la encuesta de feedback. */

/** Si toca mostrar la encuesta sola. Lo resuelve la API. */
export function useFeedbackStatus() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [QueryKeys.feedbackStatus],
    queryFn: () => feedbackApi.status(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function useSubmitFeedback() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: feedbackApi.submit,
    onSuccess: (data) => {
      queryClient.setQueryData([QueryKeys.feedbackStatus], data);
      queryClient.invalidateQueries({ queryKey: [QueryKeys.platformFeedback] });
      toast.success(t('feedback.thanks'));
    },
  });
}

export function useDismissFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => feedbackApi.dismiss(),
    onSuccess: (data) => queryClient.setQueryData([QueryKeys.feedbackStatus], data),
  });
}

/** Resultados agregados. A un usuario común el endpoint le contesta 403. */
export function usePlatformFeedback() {
  const { isAuthenticated, user } = useAuth();
  return useQuery({
    queryKey: [QueryKeys.platformFeedback],
    queryFn: () => feedbackApi.report(),
    enabled: isAuthenticated && isAdmin(user?.role),
  });
}
