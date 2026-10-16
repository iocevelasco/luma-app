import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateMilestoneInput,
  Milestone,
  MilestoneListResponse,
  UpdateMilestoneInput,
} from '@luma/shared';
import { milestonesApi } from '@/api/milestones';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

export function useMilestones(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.milestones, projectId],
    queryFn: () => milestonesApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateMilestoneInput) => milestonesApi.create(projectId, payload),
    onSuccess: ({ milestone }) => {
      // Entra a la caché ya, antes de que vuelva la lista: el formulario sube
      // los adjuntos contra este hito y, si alguno falla, abre su edición —
      // que lo busca en la lista y, sin esto, no lo encontraría todavía.
      queryClient.setQueryData<MilestoneListResponse>(
        [QueryKeys.milestones, projectId],
        (current) => current && { milestones: [milestone, ...current.milestones] },
      );
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      // Reportar un hito dispara avisos para los demás, no para quien lo
      // reporta — pero la bandeja propia se refresca igual por si alguien
      // está mirando la app con dos sesiones abiertas.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.notifications] });
      toast.success(t('milestone.created'));
    },
    // Sin `onError`: esta mutación se envía desde un formulario y el banner
    // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
    // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ milestoneId, ...payload }: UpdateMilestoneInput & { milestoneId: string }) =>
      milestonesApi.update(projectId, milestoneId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      toast.success(t('milestone.updated'));
    },
    // Sin `onError`: se envía desde el `FormPanel` y el banner de `FormShell`
    // muestra la falla al lado del botón — ver `useCreateMilestone`.
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (milestoneId: string) => milestonesApi.remove(projectId, milestoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.milestones, projectId] });
      toast.success(t('milestone.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

/**
 * Los endpoints de adjuntos devuelven el hito entero: se reemplaza esa entrada
 * en la caché en vez de volver a pedir la lista, que firma de nuevo todas las
 * URLs de todos los hitos.
 */
function useReplaceMilestoneInCache(projectId: string) {
  const queryClient = useQueryClient();
  return (milestone: Milestone) =>
    queryClient.setQueryData<MilestoneListResponse>(
      [QueryKeys.milestones, projectId],
      (current) =>
        current && {
          milestones: current.milestones.map((item) =>
            item.id === milestone.id ? milestone : item,
          ),
        },
    );
}

/**
 * Sin toast de éxito: se sube desde el formulario, donde el archivo aparece
 * en la lista apenas termina, y sin `onError`: el formulario muestra qué
 * archivo falló al lado de ese archivo.
 */
export function useUploadMilestoneAttachment(projectId: string) {
  const replace = useReplaceMilestoneInCache(projectId);

  return useMutation({
    mutationFn: ({ milestoneId, file }: { milestoneId: string; file: File }) =>
      milestonesApi.uploadAttachment(projectId, milestoneId, file),
    onSuccess: ({ milestone }) => replace(milestone),
  });
}

/** Sin formulario detrás del error: un borrar va por toast (ver CLAUDE.md). */
export function useRemoveMilestoneAttachment(projectId: string) {
  const replace = useReplaceMilestoneInCache(projectId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ milestoneId, attachmentId }: { milestoneId: string; attachmentId: string }) =>
      milestonesApi.removeAttachment(projectId, milestoneId, attachmentId),
    onSuccess: ({ milestone }) => {
      replace(milestone);
      toast.success(t('milestone.attachments.removed'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
