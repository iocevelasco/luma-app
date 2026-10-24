import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  BulkDeleteMaterialsInput,
  BulkUpdateMaterialsInput,
  CreateMaterialInput,
  CreateMaterialInvoiceInput,
  UpdateMaterialInput,
} from '@luma/shared';
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

/**
 * Subir o cambiar la foto. Sin formulario propio —sale del drawer una vez
 * guardado el material, o del menú de la fila—, así que la falla va por toast.
 */
export function useUploadMaterialPhoto(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ materialId, file }: { materialId: string; file: File }) =>
      materialsApi.uploadPhoto(projectId, materialId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.photo.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useRemoveMaterialPhoto(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (materialId: string) => materialsApi.removePhoto(projectId, materialId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.photo.removed'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
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

/**
 * Acciones de la barra de selección. Sin formulario detrás: la falla va por
 * toast, igual que el cambio de estado de una fila. El `onSuccess` del que
 * llama limpia la selección.
 */
export function useBulkUpdateMaterials(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: BulkUpdateMaterialsInput) => materialsApi.bulkUpdate(projectId, payload),
    onSuccess: ({ materialIds }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.bulk.updated', { count: materialIds.length }));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.error(errorMessage(error, t));
    },
  });
}

export function useBulkDeleteMaterials(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: BulkDeleteMaterialsInput) => materialsApi.bulkRemove(projectId, payload),
    onSuccess: ({ materialIds }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
      toast.success(t('material.bulk.deleted', { count: materialIds.length }));
    },
    onError: (error) => {
      refreshWhenLocked(error, queryClient, projectId);
      toast.error(errorMessage(error, t));
    },
  });
}

/**
 * Una factura es un gasto: además de Compras se refresca Finanzas, o el total
 * gastado quedaría viejo hasta recargar.
 */
function invalidateAfterInvoice(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.materials, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.expenses, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.financeSummary, projectId] });
}

export function useCreateMaterialInvoice(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ payload, receipt }: { payload: CreateMaterialInvoiceInput; receipt: File }) =>
      materialsApi.createInvoice(projectId, payload, receipt),
    onSuccess: () => {
      invalidateAfterInvoice(queryClient, projectId);
      toast.success(t('material.invoice.created'));
    },
    // Sin `onError`: se envía desde un formulario y la falla va al banner.
  });
}

/** Sin formulario detrás: la falla va por toast. */
export function useDeleteMaterialInvoice(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (invoiceId: string) => materialsApi.deleteInvoice(projectId, invoiceId),
    onSuccess: () => {
      invalidateAfterInvoice(queryClient, projectId);
      toast.success(t('material.invoice.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
