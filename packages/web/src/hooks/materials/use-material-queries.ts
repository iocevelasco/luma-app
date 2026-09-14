import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateMaterialInput, UpdateMaterialInput } from '@luma/shared';
import { materialsApi } from '@/api/materials';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useMaterials(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.materials, projectId],
    queryFn: () => materialsApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateMaterial(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateMaterialInput) => materialsApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.list.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('material.errors.create'))),
  });
}

export function useUpdateMaterial(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ materialId, payload }: { materialId: string; payload: UpdateMaterialInput }) =>
      materialsApi.update(projectId, materialId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.list.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('material.errors.update'))),
  });
}

export function useDeleteMaterial(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (materialId: string) => materialsApi.remove(projectId, materialId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.list.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t('material.errors.delete'))),
  });
}
