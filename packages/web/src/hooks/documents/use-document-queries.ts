import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateProjectDocumentInput, UpdateProjectDocumentInput } from '@luma/shared';
import { documentsApi } from '@/api/documents';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


export function useProjectDocuments(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.projectDocuments, projectId],
    queryFn: () => documentsApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
    /*
     * Las URLs vienen firmadas con un TTL (una hora por default). Con el
     * `staleTime` infinito de otras listas, una pestaña abierta toda la mañana
     * terminaría mostrando enlaces vencidos. Media hora deja margen de sobra
     * antes de que la primera firma caduque.
     */
    staleTime: 30 * 60 * 1000,
  });
}

/** El archivo de un documento como `Blob`, para la vista previa de un PDF. */
export function useProjectDocumentFile(projectId: string, documentId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.projectDocumentFile, projectId, documentId],
    queryFn: () => documentsApi.file(projectId, documentId!),
    enabled: isAuthenticated && !!documentId,
    // Un documento no cambia: se reabre sin volver a bajarlo. Pero un PDF
    // pesa hasta 20MB, así que no se queda en memoria más de unos minutos.
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreateProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ file, ...payload }: CreateProjectDocumentInput & { file: File }) =>
      documentsApi.create(projectId, payload, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] });
      toast.success(t('document.created'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useUpdateProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      documentId,
      ...payload
    }: UpdateProjectDocumentInput & { documentId: string }) =>
      documentsApi.update(projectId, documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] });
      toast.success(t('document.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteProjectDocument(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.remove(projectId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] });
      toast.success(t('document.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

/**
 * Espera a **todas** las peticiones, no sólo a la primera que falla: con
 * `Promise.all` el listado se recargaría mientras las otras siguen en vuelo y
 * mostraría un estado a medias que nadie vuelve a refrescar.
 */
async function settleAll(requests: Promise<unknown>[]): Promise<void> {
  const results = await Promise.allSettled(requests);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed) throw (failed as PromiseRejectedResult).reason;
}

/**
 * Mover o renombrar varias cosas a la vez (el explorador de archivos): un solo
 * aviso al final en vez de uno por documento. Si alguno falla, el listado se
 * recarga igual —los que sí se aplicaron tienen que verse—.
 */
export function useUpdateProjectDocuments(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (changes: Array<UpdateProjectDocumentInput & { documentId: string }>) =>
      settleAll(
        changes.map(({ documentId, ...payload }) =>
          documentsApi.update(projectId, documentId, payload),
        ),
      ),
    onSuccess: () => toast.success(t('document.updated')),
    onError: (error) => toast.error(errorMessage(error, t)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] }),
  });
}

export function useDeleteProjectDocuments(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (documentIds: string[]) =>
      settleAll(documentIds.map((documentId) => documentsApi.remove(projectId, documentId))),
    onSuccess: () => toast.success(t('document.deleted')),
    onError: (error) => toast.error(errorMessage(error, t)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] }),
  });
}
