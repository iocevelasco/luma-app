import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { CreateProjectInput, InviteClientInput } from '@luma/shared';
import { projectsApi } from '@/api/projects';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { projectDetailPath } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-auth-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

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
    onError: (error) => toast.error(errorMessage(error, t('project.errors.create'))),
  });
}

export function useInviteClient(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: InviteClientInput) => projectsApi.inviteClient(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.project, projectId] });
      toast.success(t('project.detail.clientInvited'));
    },
    onError: (error) => toast.error(errorMessage(error, t('project.errors.invite'))),
  });
}
