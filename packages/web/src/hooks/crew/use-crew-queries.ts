import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateCrewGoalInput,
  CreateCrewMemberInput,
  UpdateCrewGoalInput,
  UpdateCrewMemberInput,
} from '@luma/shared';
import { crewApi } from '@/api/crew';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-provider-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

/** Personal fijo de la Empresa más el contratado para esta obra. */
export function useCrewMembers(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.crewMembers, projectId],
    queryFn: () => crewApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

/** Metas de una semana puntual (`weekStart` = lunes en `YYYY-MM-DD`). */
export function useCrewGoals(projectId: string | undefined, weekStart: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.crewGoals, projectId, weekStart],
    queryFn: () => crewApi.listGoals(projectId!, weekStart),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateCrewMember(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateCrewMemberInput) => crewApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewMembers, projectId] });
      toast.success(t('crew.list.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.create'))),
  });
}

export function useUpdateCrewMember(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      crewMemberId,
      payload,
    }: {
      crewMemberId: string;
      payload: UpdateCrewMemberInput;
    }) => crewApi.update(projectId, crewMemberId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewMembers, projectId] });
      toast.success(t('crew.list.updated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.update'))),
  });
}

export function useDeactivateCrewMember(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (crewMemberId: string) => crewApi.deactivate(projectId, crewMemberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewMembers, projectId] });
      // Las metas muestran el nombre de quien las tiene: si alguien sale del
      // roster, la lista de la semana tiene que reflejarlo.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewGoals, projectId] });
      toast.success(t('crew.list.deactivated'));
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.deactivate'))),
  });
}

export function useCreateCrewGoal(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateCrewGoalInput) => crewApi.createGoal(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewGoals, projectId] });
      toast.success(t('crew.goals.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.createGoal'))),
  });
}

/** Sin toast: marcar metas de a una dispararía un toast por click. */
export function useUpdateCrewGoal(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ goalId, payload }: { goalId: string; payload: UpdateCrewGoalInput }) =>
      crewApi.updateGoal(projectId, goalId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewGoals, projectId] });
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.updateGoal'))),
  });
}

export function useDeleteCrewGoal(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (goalId: string) => crewApi.deleteGoal(projectId, goalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewGoals, projectId] });
      toast.success(t('crew.goals.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t('crew.errors.deleteGoal'))),
  });
}
