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
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-provider-queries.ts`. */


/** Personal fijo de la Empresa más el contratado para esta obra. */
export function useCrewMembers(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.crewMembers, projectId],
    queryFn: () => crewApi.list(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

/**
 * Metas de una semana puntual (`weekStart` = lunes en `YYYY-MM-DD`).
 *
 * Con `includeCarried` suma lo pendiente de semanas anteriores. Sólo tiene
 * sentido para la semana en curso: una semana pasada se mira como era, y
 * mezclarle lo que sigue abierto hoy la falsearía.
 */
export function useCrewGoals(
  projectId: string | undefined,
  weekStart: string | undefined,
  options?: { includeCarried?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const includeCarried = Boolean(options?.includeCarried);

  return useQuery({
    queryKey: [QueryKeys.crewGoals, projectId, weekStart, { includeCarried }],
    queryFn: () => crewApi.listGoals(projectId!, weekStart, { includeCarried }),
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
      // Nace en la libreta de la Empresa: Empleados y los buscadores de las
      // otras obras tienen que verlo.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationCrew] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewDirectory] });
      toast.success(t('crew.list.created'));
    },
    // Sin toast de error: el alta vive en un drawer y la falla va en su
    // banner, pegada al botón. El 409 de duplicado además trae salidas.
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

/** Lo de la libreta de la Empresa que esta obra todavía no tiene. */
export function useCrewDirectory(projectId: string | undefined, enabled = true) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.crewDirectory, projectId],
    queryFn: () => crewApi.listDirectory(projectId!),
    enabled: isAuthenticated && !!projectId && enabled,
  });
}

function useInvalidateProjectCrew(projectId: string) {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewMembers, projectId] });
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.crewDirectory, projectId] });
    void queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationCrew] });
  };
}

/**
 * Suma a la obra a alguien que ya está en la Empresa. Con `reactivate`, lo
 * reactiva en el mismo paso (sólo el gerente).
 *
 * Sin `onError` propio: cada lugar decide su canal. El drawer de alta lo
 * muestra en su banner; la lista de "Personal fijo", que no tiene formulario,
 * pasa un `onError` con toast.
 */
export function useAddCrewMemberToProject(projectId: string) {
  const invalidate = useInvalidateProjectCrew(projectId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ crewMemberId, reactivate }: { crewMemberId: string; reactivate?: boolean }) =>
      crewApi.addFromDirectory(projectId, crewMemberId, { reactivate }),
    onSuccess: () => {
      invalidate();
      toast.success(t('directory.addedToProject'));
    },
  });
}

export function useRemoveCrewMemberFromProject(projectId: string) {
  const invalidate = useInvalidateProjectCrew(projectId);
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (crewMemberId: string) => crewApi.removeFromProject(projectId, crewMemberId),
    onSuccess: () => {
      invalidate();
      toast.success(t('directory.removedFromProject'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
