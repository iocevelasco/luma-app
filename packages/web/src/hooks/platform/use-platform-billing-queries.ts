import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  ManualExchangeRateInput,
  ReviewSubscriptionPaymentInput,
  SubscriptionPaymentStatus,
} from '@luma/shared';
import { platformBillingApi } from '@/api/subscription';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/**
 * Capa 2 de lo que opera el admin de plataforma. `enabled` pide además el
 * rol: a un usuario común el endpoint le contesta 403, y no hay por qué
 * preguntarlo.
 */
function useIsPlatformAdmin() {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated && isAdmin(user?.role);
}

export function usePlatformPayments(status: SubscriptionPaymentStatus) {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.adminSubscriptionPayments, status],
    queryFn: () => platformBillingApi.payments(status),
    enabled,
    select: (data) => data.payments,
    // La cola se llena sola: que no haga falta recargar para ver uno nuevo.
    refetchInterval: status === 'pendiente' ? 60_000 : false,
  });
}

export function useReviewSubscriptionPayment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ paymentId, decision }: { paymentId: string; decision: ReviewSubscriptionPaymentInput }) =>
      platformBillingApi.review(paymentId, decision),
    onSuccess: (_data, { decision }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.adminSubscriptionPayments] });
      toast.success(
        t(decision.decision === 'aprobar' ? 'platform.payments.approved' : 'platform.payments.rejected'),
      );
    },
    // Sin `onError` acá: el rechazo sale de un formulario (motivo) y lo
    // muestra su banner; el aprobar es una acción suelta y lo muestra la fila.
  });
}

export function useExchangeRates() {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.exchangeRates],
    queryFn: () => platformBillingApi.rates(),
    enabled,
  });
}

export function useRefreshExchangeRate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => platformBillingApi.refreshRate(),
    onSuccess: ({ status }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.exchangeRates] });
      if (status === 'marcada') toast.warning(t('platform.rates.flaggedToast'));
      else toast.success(t('platform.rates.refreshed'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useSaveManualRate() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ManualExchangeRateInput) => platformBillingApi.saveManualRate(payload),
    onSuccess: ({ plausible }) => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.exchangeRates] });
      if (plausible) toast.success(t('platform.rates.saved'));
      else toast.warning(t('platform.rates.savedImplausible'));
    },
    // Sin `onError`: sale de un formulario.
  });
}
