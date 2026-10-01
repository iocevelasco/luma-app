import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateProviderEngagementInput,
  UpdateProviderEngagementInput,
} from '@luma/shared';
import { providersApi } from '@/api/providers';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2 de la contratación del proveedor. Archivo aparte de
 *  `use-provider-queries.ts`: es otro dominio (lo comercial, no el contacto). */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useProviderEngagements(
  projectId: string | undefined,
  providerId: string | undefined,
) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.providerEngagements, projectId, providerId],
    queryFn: () => providersApi.listEngagements(projectId!, providerId!),
    enabled: isAuthenticated && !!projectId && !!providerId,
  });
}

function useInvalidateEngagements(projectId: string, providerId: string) {
  const queryClient = useQueryClient();

  return () =>
    void queryClient.invalidateQueries({
      queryKey: [QueryKeys.providerEngagements, projectId, providerId],
    });
}

export function useCreateEngagement(projectId: string, providerId: string) {
  const invalidate = useInvalidateEngagements(projectId, providerId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateProviderEngagementInput) =>
      providersApi.createEngagement(projectId, providerId, payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('engagement.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('engagement.errors.create'))),
  });
}

export function useUpdateEngagement(projectId: string, providerId: string) {
  const invalidate = useInvalidateEngagements(projectId, providerId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      engagementId,
      payload,
    }: {
      engagementId: string;
      payload: UpdateProviderEngagementInput;
    }) => providersApi.updateEngagement(projectId, providerId, engagementId, payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('engagement.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('engagement.errors.update'))),
  });
}

export function useDeleteEngagement(projectId: string, providerId: string) {
  const invalidate = useInvalidateEngagements(projectId, providerId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (engagementId: string) =>
      providersApi.deleteEngagement(projectId, providerId, engagementId),
    onSuccess: () => {
      invalidate();
      toast.success(t('engagement.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t('engagement.errors.delete'))),
  });
}

/** Sin toast de éxito: tildar una lista de requisitos dispara uno por click. */
export function useSetRequirementMet(projectId: string, providerId: string) {
  const invalidate = useInvalidateEngagements(projectId, providerId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      engagementId,
      requirementId,
      met,
    }: {
      engagementId: string;
      requirementId: string;
      met: boolean;
    }) => providersApi.setRequirementMet(projectId, providerId, engagementId, requirementId, met),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, t('engagement.errors.requirement'))),
  });
}
