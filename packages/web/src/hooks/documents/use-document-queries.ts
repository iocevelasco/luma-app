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
 * Mover o renombrar varias cosas a la vez (el explorador de archivos): un solo
 * aviso al final en vez de uno por documento. Si alguno falla, el listado se
 * recarga igual —los que sí se aplicaron tienen que verse—.
 */
export function useUpdateProjectDocuments(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (changes: Array<UpdateProjectDocumentInput & { documentId: string }>) =>
      Promise.all(
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
      Promise.all(documentIds.map((documentId) => documentsApi.remove(projectId, documentId))),
    onSuccess: () => toast.success(t('document.deleted')),
    onError: (error) => toast.error(errorMessage(error, t)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [QueryKeys.projectDocuments, projectId] }),
  });
}
