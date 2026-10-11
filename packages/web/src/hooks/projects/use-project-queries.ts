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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      toast.success(t('project.detail.memberInvited'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
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
