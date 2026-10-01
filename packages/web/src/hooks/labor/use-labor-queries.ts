import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { LaborRecordInput } from '@luma/shared';
import { activitiesApi } from '@/api/activities';
import { laborApi } from '@/api/labor';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-activity-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useLaborRecords(projectId: string | undefined, date: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.laborRecords, projectId, date],
    queryFn: () => laborApi.list(projectId!, date),
    enabled: isAuthenticated && !!projectId && !!date,
  });
}

/**
 * Sin toast: la asistencia se guarda sola al tocar cada persona, y un toast
 * por tilde sería una cascada. El error sí avisa.
 */
export function useUpsertLaborRecord(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: LaborRecordInput) => laborApi.upsert(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.laborRecords, projectId] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t('labor.errors.save'))),
  });
}

/**
 * La asistencia del día entera: esperados y presentes de cada actividad
 * vigente. Una consulta para toda la pantalla, en vez de una por actividad
 * sólo para poder sumar el total de la obra.
 */
export function useDayAttendance(projectId: string | undefined, date: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.activityCrew, projectId, date],
    queryFn: () => laborApi.attendance(projectId!, date!),
    enabled: isAuthenticated && !!projectId && !!date,
  });
}

export function useAssignCrewToActivity(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (crewMemberId: string) =>
      activitiesApi.assignCrew(projectId, activityId, crewMemberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
      toast.success(t('labor.crew.assigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('labor.errors.assignCrew'))),
  });
}

export function useUnassignCrewFromActivity(projectId: string, activityId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (crewMemberId: string) =>
      activitiesApi.unassignCrew(projectId, activityId, crewMemberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.activityCrew, projectId] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.laborRecords, projectId] });
      toast.success(t('labor.crew.unassigned'));
    },
    onError: (error) => toast.error(errorMessage(error, t('labor.errors.unassignCrew'))),
  });
}
