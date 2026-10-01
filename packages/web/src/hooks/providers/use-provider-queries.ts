import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  AssignActivityInput,
  AssignProviderInput,
  CreateProviderInput,
  UpdateProviderInput,
} from '@luma/shared';
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

// --- Misma relación N:N, vista desde el proveedor (listado de Proveedores) ---

/** Actividades de esta obra donde ya está asignado este proveedor. */
export function useProviderActivities(projectId: string | undefined, providerId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.providerActivities, projectId, providerId],
    queryFn: () => providersApi.listActivities(projectId!, providerId!),
    enabled: isAuthenticated && !!projectId && !!providerId,
  });
}

/**
 * Invalida las dos vistas de la misma relación: la lista de actividades de
 * este proveedor (donde se dispara) y las de proveedores de la actividad
 * afectada (donde también se ve, desde `project-activities.tsx`) — sin esto
 * asignar desde acá dejaría el detalle de la Actividad con datos viejos hasta
 * el próximo refetch.
 */
function invalidateProviderActivityLinks(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  providerId: string,
  activityId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: [QueryKeys.providerActivities, projectId, providerId],
  });
  void queryClient.invalidateQueries({
    queryKey: [QueryKeys.activityProviders, projectId, activityId],
  });
}

export function useAssignActivityToProvider(projectId: string, providerId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: AssignActivityInput) =>
      providersApi.assignActivity(projectId, providerId, payload),
    onSuccess: (_, payload) => {
      invalidateProviderActivityLinks(queryClient, projectId, providerId, payload.activityId);
      toast.success(t('provider.list.assigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.assign'))),
  });
}

export function useUnassignActivityFromProvider(projectId: string, providerId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (activityId: string) =>
      providersApi.unassignActivity(projectId, providerId, activityId),
    onSuccess: (_, activityId) => {
      invalidateProviderActivityLinks(queryClient, projectId, providerId, activityId);
      toast.success(t('provider.list.unassigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.unassign'))),
  });
}

/**
 * Sólo para el alta con asignación inmediata (Nuevo proveedor → elegir
 * actividades). Asigna varias de una, sin pasar por `apiClient` desde el
 * componente — la capa 1 vive acá, no en `NewProviderDialog`.
 */
export function useAssignActivitiesToProvider(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ providerId, activityIds }: { providerId: string; activityIds: string[] }) =>
      Promise.all(
        activityIds.map((activityId) => providersApi.assignActivity(projectId, providerId, { activityId })),
      ),
    onSuccess: (_, { providerId }) => {
      void queryClient.invalidateQueries({
        queryKey: [QueryKeys.providerActivities, projectId, providerId],
      });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityProviders, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t('provider.errors.assign'))),
  });
}
