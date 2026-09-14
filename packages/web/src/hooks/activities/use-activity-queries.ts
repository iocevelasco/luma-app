import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateActivityInput, UpdateActivityInput } from '@luma/shared';
import { activitiesApi } from '@/api/activities';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import type { WeekRange } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

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
    onError: (error) => toast.error(errorMessage(error, t('activity.errors.create'))),
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
    onError: (error) => toast.error(errorMessage(error, t('activity.errors.update'))),
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
    onError: (error) => toast.error(errorMessage(error, t('activity.errors.delete'))),
  });
}
