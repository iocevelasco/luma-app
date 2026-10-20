import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { BolivaresPaymentInput } from '@luma/shared';
import { subscriptionApi } from '@/api/subscription';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

/**
 * Estado de la suscripción de MI Empresa. La usan el aviso del panel, la
 * home (para saber qué pasa con "Nueva obra") y la pantalla de Suscripción:
 * una sola caché para las tres.
 *
 * `refetchInterval` cuando hay algo en curso: un pago en revisión o una
 * vuelta de Stripe, donde el webhook puede tardar unos segundos en llegar.
 */
export function useMySubscription(options: { pollWhilePending?: boolean } = {}) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.subscription],
    queryFn: () => subscriptionApi.me(),
    enabled: isAuthenticated,
    select: (data) => data.subscription,
    refetchInterval: options.pollWhilePending ? 3000 : false,
  });
}

export function useSubscriptionPayments() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.subscriptionPayments],
    queryFn: () => subscriptionApi.payments(),
    enabled: isAuthenticated,
    select: (data) => data.payments,
  });
}

/** La cotización en Bs. Sólo cuando se abre el pago: la tasa no se pide de más. */
export function useBolivaresQuote(
  activateNow: boolean,
  includeNextProject: boolean,
  enabled: boolean,
) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.bolivaresQuote, activateNow, includeNextProject],
    queryFn: () => subscriptionApi.quote(activateNow, includeNextProject),
    enabled: isAuthenticated && enabled,
    // Una cotización vieja es una tasa vieja: siempre fresca al abrir.
    staleTime: 0,
    retry: false,
  });
}

function invalidateSubscription(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.subscription] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.subscriptionPayments] });
  // Pagar puede destrabar la escritura en todas las obras.
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.projects] });
}

export function usePayInBolivares() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ payload, receipt }: { payload: BolivaresPaymentInput; receipt: File | null }) =>
      subscriptionApi.payInBolivares(payload, receipt),
    onSuccess: () => {
      invalidateSubscription(queryClient);
      toast.success(t('subscription.bolivares.sent'));
    },
    // Sin `onError`: sale de un formulario y el banner de `FormShell` lo muestra.
  });
}

/**
 * Pide a la API el checkout de Stripe.
 *
 * Si vuelve `embedded`, quien llama lo monta en `CardCheckoutDialog` (ver
 * `useCardCheckout`). Si vuelve `hosted` (el servidor no tiene publishable
 * key) se va a la página de Stripe, y la vuelta la recibe la pantalla de
 * Suscripción con `?stripe=ok`.
 */
export function useStripeCheckout() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (options: { activateNow: boolean; includeNextProject?: boolean }) =>
      subscriptionApi.stripeCheckout(options),
    onSuccess: (start) => {
      if (start.mode === 'hosted') window.location.assign(start.url);
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useStripePortal() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: () => subscriptionApi.stripePortal(),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

/** Para la vuelta desde Stripe: refrescar todo lo que el pago pudo cambiar. */
export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => invalidateSubscription(queryClient);
}
