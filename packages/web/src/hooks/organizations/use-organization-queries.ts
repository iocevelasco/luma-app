import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { InviteMemberInput } from '@luma/shared';
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
