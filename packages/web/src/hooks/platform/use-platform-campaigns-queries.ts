import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CampaignInput } from '@luma/shared';
import { platformCampaignsApi } from '@/api/platform';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2 de las campañas de correo. Mismo criterio de `enabled` que el resto de plataforma. */
function useIsPlatformAdmin() {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated && isAdmin(user?.role);
}

export function useCampaigns() {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.platformCampaigns],
    queryFn: () => platformCampaignsApi.list(),
    enabled,
    // Mientras una campaña sale, el contador avanza solo.
    refetchInterval: (query) =>
      query.state.data?.some((campaign) => campaign.status === 'sending') ? 3_000 : false,
  });
}

export function useCampaignAudience() {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.platformCampaignAudience],
    queryFn: () => platformCampaignsApi.audience(),
    enabled,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ payload, image }: { payload: CampaignInput; image: File | null }) =>
      platformCampaignsApi.create(payload, image),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.platformCampaigns] });
      toast.success(t('platform.campaigns.created'));
    },
    // Sin `onError`: sale de un formulario.
  });
}

export function useSendCampaignTest() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => platformCampaignsApi.test(id),
    onSuccess: ({ sent, to }) => {
      if (sent) toast.success(t('platform.campaigns.testSent', { email: to }));
      else toast.warning(t('platform.campaigns.testNotSent'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => platformCampaignsApi.send(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.platformCampaigns] });
      toast.success(t('platform.campaigns.sending'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (id: string) => platformCampaignsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.platformCampaigns] });
      toast.success(t('platform.campaigns.deleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}
