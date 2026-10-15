import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateCrewMemberInput,
  UpdateCrewMemberInput,
} from '@luma/shared';
import { crewApi } from '@/api/crew';
import { isAssignableCrew } from '@/lib/assignable-crew';
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
      toast.success(t('crew.list.deactivated'));
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

/**
 * El personal que se puede elegir como responsable de una tarea. Lo usan el
 * Tablero y el Cronograma: la regla vive en `lib/assignable-crew.ts`.
 */
export function useAssignableCrew(projectId: string | undefined) {
  const query = useCrewMembers(projectId);
  const members = useMemo(
    () => (query.data?.crewMembers ?? []).filter(isAssignableCrew),
    [query.data],
  );
  return { members, isLoading: query.isLoading };
}
