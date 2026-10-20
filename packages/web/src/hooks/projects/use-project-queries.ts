import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  CreateProjectInput,
  InvitableProjectRole,
  InviteProjectMemberInput,
  UpdateProjectInput,
} from '@luma/shared';
import { projectsApi } from '@/api/projects';
import { isApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { projectDetailPath } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-auth-queries.ts`. */


export function useProjects() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.projects],
    queryFn: () => projectsApi.list(),
    enabled: isAuthenticated,
  });
}

export function useProject(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.project, projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateProjectInput) => projectsApi.create(payload),
    onSuccess: ({ project }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.projects] });
      // Una obra nueva cambia la suscripción: la primera arranca el mes
      // gratis, y cada una cuenta para el límite y para el próximo cobro.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.subscription] });
      toast.success(t('project.new.created'));
      navigate(projectDetailPath(project.id));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: UpdateProjectInput) => projectsApi.update(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      // El directorio cambia de visibilidad para el cliente: su caché de
      // proveedores tiene que volver a pedirse con el permiso nuevo.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.providers, projectId] });
      toast.success(t('project.detail.settingsSaved'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useInviteProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: InviteProjectMemberInput) => projectsApi.inviteMember(projectId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      // Si invitar creó la cuenta y el mail no salió, el aviso es el diálogo
      // con el enlace; un toast verde diría que todo salió bien.
      if (data.emailSent !== false) toast.success(t('project.detail.memberInvited'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

/** Qué pasó con cada obra al darle acceso a una persona. */
export interface GrantAccessResult {
  projectId: string;
  /** `already`: ya tenía acceso (409). No es una falla: el resultado buscado ya estaba. */
  status: 'granted' | 'already' | 'failed';
  /** Texto resuelto para mostrar, sólo en `failed`. */
  message?: string;
}

/**
 * Da acceso a una persona a varias obras de una vez, con un mismo rol.
 *
 * No hay endpoint propio a propósito: cada obra pasa por la invitación de
 * siempre, que ya exige `project.invite` sobre ESA obra. Un endpoint masivo
 * tendría que reimplementar ese chequeo por cada una, y la autorización
 * quedaría en dos lugares.
 *
 * Resuelve con un resultado por obra y no rechaza si alguna falla: un fallo
 * parcial es un estado que el formulario tiene que mostrar, no una excepción.
 */
export function useGrantProjectAccess() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      email,
      role,
      projectIds,
    }: {
      email: string;
      role: InvitableProjectRole;
      projectIds: string[];
    }): Promise<GrantAccessResult[]> => {
      const settled = await Promise.allSettled(
        projectIds.map((projectId) => projectsApi.inviteMember(projectId, { email, role })),
      );

      return settled.map((outcome, index): GrantAccessResult => {
        const projectId = projectIds[index]!;
        if (outcome.status === 'fulfilled') return { projectId, status: 'granted' };
        const reason = outcome.reason;
        if (isApiError(reason) && reason.code === 'CONFLICT') {
          return { projectId, status: 'already' };
        }
        return { projectId, status: 'failed', message: errorMessage(reason, t) ?? undefined };
      });
    },
    onSuccess: (results) => {
      for (const result of results) {
        if (result.status === 'failed') continue;
        void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, result.projectId] });
      }
      if (results.every((result) => result.status !== 'failed')) {
        toast.success(t('team.grantDone', { count: results.length }));
      }
    },
    // Sin `onError`: `mutationFn` no rechaza (ver arriba) y la falla parcial la
    // muestra el banner del diálogo.
  });
}

export function useUpdateProjectMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      membershipId,
      role,
    }: {
      membershipId: string;
      role: InvitableProjectRole;
    }) => projectsApi.updateMemberRole(projectId, membershipId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      toast.success(t('project.team.roleChanged'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (membershipId: string) => projectsApi.removeMember(projectId, membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      toast.success(t('project.team.removed'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
