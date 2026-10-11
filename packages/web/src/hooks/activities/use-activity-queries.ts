import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateActivityInput, UpdateActivityInput } from '@luma/shared';
import { activitiesApi } from '@/api/activities';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import type { WeekRange } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


export function useActivities(projectId: string | undefined, range: WeekRange) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.activities, projectId, range.from, range.to],
    queryFn: () => activitiesApi.list(projectId!, range),
    enabled: isAuthenticated && !!projectId,
  });
}

/** Todas las actividades de la obra, sin filtro de rango — para cruzar con materiales. */
export function useAllActivities(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.activities, projectId, 'all'],
    queryFn: () => activitiesApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateActivityInput) => activitiesApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
      toast.success(t('activity.list.created'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useUpdateActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ activityId, payload }: { activityId: string; payload: UpdateActivityInput }) =>
      activitiesApi.update(projectId, activityId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
      toast.success(t('activity.list.updated'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

/** El supervisor devuelve el trabajo reportado, con motivo. */
export function useRejectActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ activityId, reason }: { activityId: string; reason: string }) =>
      activitiesApi.reject(projectId, activityId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
      toast.success(t('activity.review.rejected'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (activityId: string) => activitiesApi.remove(projectId, activityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('activity.list.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useUploadActivityEvidence(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (file: File) => activitiesApi.uploadEvidence(projectId, activityId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteActivityEvidence(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (evidenceId: string) =>
      activitiesApi.removeEvidence(projectId, activityId, evidenceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
