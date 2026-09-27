import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AssignProviderInput, CreateProviderInput, UpdateProviderInput } from '@luma/shared';
import { providersApi } from '@/api/providers';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-activity-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

/** Directorio de proveedores de la Empresa dueña de esta obra. */
export function useProviders(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.providers, projectId],
    queryFn: () => providersApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

/** Proveedores ya asignados a una actividad puntual. */
export function useActivityProviders(projectId: string | undefined, activityId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.activityProviders, projectId, activityId],
    queryFn: () => providersApi.listForActivity(projectId!, activityId!),
    enabled: isAuthenticated && !!projectId && !!activityId,
  });
}

export function useCreateProvider(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateProviderInput) => providersApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.providers, projectId] });
      toast.success(t('provider.list.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.create'))),
  });
}

export function useUpdateProvider(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ providerId, payload }: { providerId: string; payload: UpdateProviderInput }) =>
      providersApi.update(projectId, providerId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.providers, projectId] });
      toast.success(t('provider.list.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.update'))),
  });
}

export function useDeactivateProvider(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (providerId: string) => providersApi.deactivate(projectId, providerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.providers, projectId] });
      toast.success(t('provider.list.deactivated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.deactivate'))),
  });
}

export function useAssignProvider(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: AssignProviderInput) =>
      providersApi.assignToActivity(projectId, activityId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryKeys.activityProviders, projectId, activityId],
      });
      toast.success(t('provider.list.assigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.assign'))),
  });
}

export function useUnassignProvider(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (providerId: string) =>
      providersApi.unassignFromActivity(projectId, activityId, providerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [QueryKeys.activityProviders, projectId, activityId],
      });
      toast.success(t('provider.list.unassigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.unassign'))),
  });
}
