import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateCrewMemberInput,
  CreateProviderInput,
  InviteMemberInput,
  UpdateCrewMemberInput,
  UpdateOrganizationInput,
  UpdateOrganizationMemberInput,
  UpdateProviderInput,
} from '@luma/shared';
import { organizationsApi } from '@/api/organizations';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-auth-queries.ts`. */


export function useMyOrganization() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.organization],
    queryFn: () => organizationsApi.me(),
    enabled: isAuthenticated,
  });
}

export function useRenameOrganization() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (name: string) => organizationsApi.rename(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organization] });
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useOrganizationMembers() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.organizationMembers],
    queryFn: () => organizationsApi.listMembers(),
    enabled: isAuthenticated,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: InviteMemberInput) => organizationsApi.inviteMember(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] });
      toast.success(t('team.invited'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

/**
 * Guardar datos de la Empresa. Sin `onError`: se envía desde un formulario y el
 * banner de `FormShell` muestra la falla ahí mismo.
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: UpdateOrganizationInput) => organizationsApi.update(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organization] });
      toast.success(t('company.saved'));
    },
  });
}

export function useUpdateOrganizationMember() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ memberId, payload }: { memberId: string; payload: UpdateOrganizationMemberInput }) =>
      organizationsApi.updateMember(memberId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] });
      toast.success(t('team.updated'));
    },
  });
}

export function useRemoveOrganizationMember() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (memberId: string) => organizationsApi.removeMember(memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organizationMembers] });
      toast.success(t('team.removed'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useResendMemberInvitation() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (memberId: string) => organizationsApi.resendInvitation(memberId),
    onSuccess: () => toast.success(t('team.invitationResent')),
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

// --- Libreta de la Empresa: proveedores y empleados ---

/** Un cambio en la libreta se ve también desde cada obra y en los selectores. */
function useInvalidateDirectory() {
  const queryClient = useQueryClient();

  return () => {
    for (const key of [
      QueryKeys.organizationProviders,
      QueryKeys.organizationCrew,
      QueryKeys.providers,
      QueryKeys.crewMembers,
      QueryKeys.providerDirectory,
      QueryKeys.crewDirectory,
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useOrganizationProviders() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.organizationProviders],
    queryFn: () => organizationsApi.listProviders(),
    enabled: isAuthenticated,
  });
}

export function useCreateOrganizationProvider() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateProviderInput) => organizationsApi.createProvider(payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('provider.list.created'));
    },
  });
}

export function useUpdateOrganizationProvider() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ providerId, payload }: { providerId: string; payload: UpdateProviderInput }) =>
      organizationsApi.updateProvider(providerId, payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('provider.list.updated'));
    },
  });
}

export function useDeactivateOrganizationProvider() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (providerId: string) => organizationsApi.deactivateProvider(providerId),
    onSuccess: () => {
      invalidate();
      toast.success(t('provider.list.deactivated'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useSetProviderProjects() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ providerId, projectIds }: { providerId: string; projectIds: string[] }) =>
      organizationsApi.setProviderProjects(providerId, projectIds),
    onSuccess: () => {
      invalidate();
      toast.success(t('directory.projectsSaved'));
    },
  });
}

export function useOrganizationCrew() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.organizationCrew],
    queryFn: () => organizationsApi.listCrew(),
    enabled: isAuthenticated,
  });
}

export function useCreateOrganizationCrewMember() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateCrewMemberInput) => organizationsApi.createCrewMember(payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('crew.list.created'));
    },
  });
}

export function useUpdateOrganizationCrewMember() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({
      crewMemberId,
      payload,
    }: {
      crewMemberId: string;
      payload: UpdateCrewMemberInput;
    }) => organizationsApi.updateCrewMember(crewMemberId, payload),
    onSuccess: () => {
      invalidate();
      toast.success(t('crew.list.updated'));
    },
  });
}

export function useDeactivateOrganizationCrewMember() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (crewMemberId: string) => organizationsApi.deactivateCrewMember(crewMemberId),
    onSuccess: () => {
      invalidate();
      toast.success(t('crew.list.deactivated'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useSetCrewMemberProjects() {
  const invalidate = useInvalidateDirectory();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ crewMemberId, projectIds }: { crewMemberId: string; projectIds: string[] }) =>
      organizationsApi.setCrewMemberProjects(crewMemberId, projectIds),
    onSuccess: () => {
      invalidate();
      toast.success(t('directory.projectsSaved'));
    },
  });
}
