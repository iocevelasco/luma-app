import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateMaterialInput, UpdateMaterialInput } from '@luma/shared';
import { materialsApi } from '@/api/materials';
import { isApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


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
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

/**
 * Si el servidor dice que el material ya está bloqueado, la fila que se ve
 * está desactualizada: otra persona lo movió de Pendiente. Se vuelve a pedir
 * la lista para que la fila deje de ofrecer editar y eliminar.
 */
function refreshWhenLocked(
  error: unknown,
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  if (isApiError(error) && error.code === 'MATERIAL_LOCKED') {
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
  }
}

/** Cambio de estado desde la fila: sin formulario detrás, así que la falla va por toast. */
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
    onError: (error) => {
      refreshWhenLocked(error, queryClient, projectId);
      toast.error(errorMessage(error, t));
    },
  });
}

/**
 * Corregir un material desde el drawer de edición. Aparte de `useUpdateMaterial`
 * porque acá la falla se muestra en el banner del formulario y un toast sería
 * el mismo mensaje dos veces, en dos lugares distintos de la pantalla.
 */
export function useEditMaterial(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ materialId, payload }: { materialId: string; payload: UpdateMaterialInput }) =>
      materialsApi.update(projectId, materialId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.list.updated'));
    },
    onError: (error) => refreshWhenLocked(error, queryClient, projectId),
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
    onError: (error) => {
      refreshWhenLocked(error, queryClient, projectId);
      toast.error(errorMessage(error, t));
    },
  });
}
