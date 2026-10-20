import type {
  AdminSubscriptionPayment,
  ApiResponse,
  BcvRate,
  BolivaresPaymentInput,
  BolivaresQuote,
  ExchangeRateRecord,
  ExchangeRatesResponse,
  ManualExchangeRateInput,
  ReviewSubscriptionPaymentInput,
  StripeCheckoutStart,
  SubscriptionOverview,
  SubscriptionPaymentStatus,
  SubscriptionPaymentSummary,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/projects.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const subscriptionApi = {
  me: () => unwrap<{ subscription: SubscriptionOverview }>(apiClient.get('/api/subscription/me')),

  rate: () => unwrap<{ rate: BcvRate }>(apiClient.get('/api/subscription/rate')),

  quote: (activateNow: boolean, includeNextProject = false) => {
    const params = new URLSearchParams();
    if (activateNow) params.set('activateNow', 'true');
    if (activateNow && includeNextProject) params.set('includeNextProject', 'true');
    const query = params.toString();
    return unwrap<BolivaresQuote>(
      apiClient.get(`/api/subscription/quote${query ? `?${query}` : ''}`),
    );
  },

  payments: () =>
    unwrap<{ payments: SubscriptionPaymentSummary[] }>(apiClient.get('/api/subscription/payments')),

  /** El comprobante viaja con los datos en un solo multipart. */
  payInBolivares: (payload: BolivaresPaymentInput, receipt: File | null) => {
    const formData = new FormData();
    if (receipt) formData.append('receipt', receipt);
    formData.append('method', payload.method);
    formData.append('bank', payload.bank);
    formData.append('reference', payload.reference);
    formData.append('payerId', payload.payerId);
    formData.append('paidOn', payload.paidOn);
    formData.append('amountBs', String(payload.amountBs));
    formData.append('activateNow', String(payload.activateNow));
    formData.append('includeNextProject', String(payload.includeNextProject));
    return unwrap<{ payment: SubscriptionPaymentSummary }>(
      apiClient.post('/api/subscription/payments', formData),
    );
  },

  stripeCheckout: (options: { activateNow: boolean; includeNextProject?: boolean }) =>
    unwrap<StripeCheckoutStart>(apiClient.post('/api/subscription/stripe/checkout', options)),

  stripePortal: () => unwrap<{ url: string }>(apiClient.post('/api/subscription/stripe/portal')),
};

/** Sólo admin de plataforma. */
export const platformBillingApi = {
  payments: (status: SubscriptionPaymentStatus) =>
    unwrap<{ payments: AdminSubscriptionPayment[] }>(
      apiClient.get(`/api/admin/subscription-payments?status=${status}`),
    ),

  review: (paymentId: string, decision: ReviewSubscriptionPaymentInput) =>
    unwrap<{ payment: AdminSubscriptionPayment }>(
      apiClient.post(`/api/admin/subscription-payments/${paymentId}/review`, decision),
    ),

  rates: () => unwrap<ExchangeRatesResponse>(apiClient.get('/api/admin/exchange-rates')),

  saveManualRate: (payload: ManualExchangeRateInput) =>
    unwrap<{ rate: ExchangeRateRecord; plausible: boolean }>(
      apiClient.post('/api/admin/exchange-rates', payload),
    ),

  refreshRate: () =>
    unwrap<{ status: string; rate: ExchangeRateRecord }>(
      apiClient.post('/api/admin/exchange-rates/refresh'),
    ),
};
