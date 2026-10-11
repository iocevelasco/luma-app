import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@luma/shared';
import { milestonesApi } from '@/api/milestones';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


export function useMilestones(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.milestones, projectId],
    queryFn: () => milestonesApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateMilestoneInput) => milestonesApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      // Reportar un hito dispara avisos para los demás, no para quien lo
      // reporta — pero la bandeja propia se refresca igual por si alguien
      // está mirando la app con dos sesiones abiertas.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.notifications] });
      toast.success(t('milestone.created'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ milestoneId, ...payload }: UpdateMilestoneInput & { milestoneId: string }) =>
      milestonesApi.update(projectId, milestoneId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      toast.success(t('milestone.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (milestoneId: string) => milestonesApi.remove(projectId, milestoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      toast.success(t('milestone.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
