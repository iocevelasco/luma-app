import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  ActivityListResponse,
  ActivityStatus,
  CreateActivityInput,
  UpdateActivityInput,
} from '@luma/shared';
import { activitiesApi } from '@/api/activities';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import type { WeekRange } from '@/lib/week';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


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
      // Si nace con cuadrilla, aparece esperada en la asistencia de la Jornada.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
      toast.success(t('activity.list.created'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
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
      // Reasignar el responsable mueve la cuadrilla en la API: la Jornada y la
      // cuadrilla de la tarea tienen que volver a pedirla.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
      toast.success(t('activity.list.updated'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

/**
 * Mover una tarea de columna en el Tablero: sólo cambia el estado.
 *
 * Distinta de `useUpdateActivity` a propósito:
 * - Optimista: la tarjeta salta de columna al soltarla. Esperar a la API la
 *   dejaba un instante en la columna vieja y parecía que no había andado.
 * - Sin toast de éxito: mover de a una dispararía un toast por click.
 * - El error va por toast y la tarjeta vuelve a su lugar: es un cambio
 *   inline, no hay formulario donde poner un banner.
 */
export function useMoveActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const key = [QueryKeys.activities, projectId];

  return useMutation({
    mutationFn: ({ activityId, status }: { activityId: string; status: ActivityStatus }) =>
      activitiesApi.update(projectId, activityId, { status }),
    onMutate: async ({ activityId, status }) => {
      // Se cancela sin esperar: el cambio optimista tiene que verse en el cuadro
      // en que se suelta la tarjeta. Esperar la cancelación la dejaba un instante
      // de vuelta en su columna de origen antes de saltar a la nueva.
      const cancelling = queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData<ActivityListResponse>({ queryKey: key });
      // `updatedAt` también: el Tablero deja a la vista lo que se tocó esta semana
      // (ver `tasksForWeek`), y una atrasada que se completa no puede esfumarse
      // hasta que llegue la respuesta.
      const now = new Date().toISOString();
      queryClient.setQueriesData<ActivityListResponse>({ queryKey: key }, (data) =>
        data
          ? {
              ...data,
              activities: data.activities.map((activity) =>
                activity.id === activityId ? { ...activity, status, updatedAt: now } : activity,
              ),
            }
          : data,
      );
      await cancelling;
      return { previous };
    },
    onError: (error, _variables, context) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(errorMessage(error, t));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Mover las fechas de una actividad arrastrando su barra en el Cronograma.
 *
 * Optimista, por la misma razón que `useMoveActivity`: la barra ya está en su
 * lugar nuevo cuando se suelta, y si la API la rechaza tiene que volver. Sin
 * volver a escribir la caché el diagrama se quedaría con la barra movida,
 * porque la librería no se entera de que el servidor dijo que no.
 *
 * Distinta de `useUpdateActivity` a propósito: no hay formulario donde poner
 * un banner de error, así que la falla va por toast.
 */
export function useRescheduleActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const key = [QueryKeys.activities, projectId];

  return useMutation({
    mutationFn: ({
      activityId,
      startDate,
      endDate,
    }: {
      activityId: string;
      startDate: string;
      endDate: string;
    }) => activitiesApi.update(projectId, activityId, { startDate, endDate }),
    onMutate: async ({ activityId, startDate, endDate }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData<ActivityListResponse>({ queryKey: key });
      queryClient.setQueriesData<ActivityListResponse>({ queryKey: key }, (data) =>
        data
          ? {
              ...data,
              activities: data.activities.map((activity) =>
                activity.id === activityId ? { ...activity, startDate, endDate } : activity,
              ),
            }
          : data,
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success(t('activity.gantt.rescheduled'));
    },
    onError: (error, _variables, context) => {
      for (const [queryKey, data] of context?.previous ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      toast.error(errorMessage(error, t));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      // Un cambio de fechas mueve a quién se espera cada día en la Jornada.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
    },
  });
}

/** El supervisor devuelve el trabajo reportado, con motivo. */
export function useRejectActivity(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ activityId, reason }: { activityId: string; reason: string }) =>
      activitiesApi.reject(projectId, activityId, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
      toast.success(t('activity.review.rejected'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useUploadActivityEvidence(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (file: File) => activitiesApi.uploadEvidence(projectId, activityId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteActivityEvidence(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (evidenceId: string) =>
      activitiesApi.removeEvidence(projectId, activityId, evidenceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activities, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
