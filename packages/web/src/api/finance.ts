import type {
  ApiResponse,
  CreateExpenseInput,
  CreatePaymentInput,
  CreatePaymentScheduleItemInput,
  DeleteResponse,
  ExpenseListResponse,
  ExpenseResponse,
  FinanceSummaryResponse,
  PaymentListResponse,
  PaymentResponse,
  PaymentScheduleItemResponse,
  PaymentScheduleListResponse,
  PayrollResponse,
  UpdateExpenseInput,
  UpdatePaymentScheduleItemInput,
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

const base = (projectId: string) => `/api/projects/${projectId}/finance`;

export const financeApi = {
  // ── Cobros: el cliente los ve ─────────────────────────────────────────────
  schedule: (projectId: string) =>
    unwrap<PaymentScheduleListResponse>(apiClient.get(`${base(projectId)}/schedule`)),

  createScheduleItem: (projectId: string, payload: CreatePaymentScheduleItemInput) =>
    unwrap<PaymentScheduleItemResponse>(apiClient.post(`${base(projectId)}/schedule`, payload)),

  updateScheduleItem: (
    projectId: string,
    itemId: string,
    payload: UpdatePaymentScheduleItemInput,
  ) =>
    unwrap<PaymentScheduleItemResponse>(
      apiClient.patch(`${base(projectId)}/schedule/${itemId}`, payload),
    ),

  deleteScheduleItem: (projectId: string, itemId: string) =>
    unwrap<DeleteResponse>(apiClient.delete(`${base(projectId)}/schedule/${itemId}`)),

  payments: (projectId: string) =>
    unwrap<PaymentListResponse>(apiClient.get(`${base(projectId)}/payments`)),

  createPayment: (projectId: string, payload: CreatePaymentInput) =>
    unwrap<PaymentResponse>(apiClient.post(`${base(projectId)}/payments`, payload)),

  deletePayment: (projectId: string, paymentId: string) =>
    unwrap<DeleteResponse>(apiClient.delete(`${base(projectId)}/payments/${paymentId}`)),

  // ── Gastos: el cliente NO los ve ──────────────────────────────────────────
  expenses: (projectId: string) =>
    unwrap<ExpenseListResponse>(apiClient.get(`${base(projectId)}/expenses`)),

  /** El comprobante viaja con la ficha en un solo multipart; es opcional. */
  createExpense: (projectId: string, payload: CreateExpenseInput, receipt?: File | null) => {
    const formData = new FormData();
    if (receipt) formData.append('receipt', receipt);
    formData.append('amount', String(payload.amount));
    formData.append('currency', payload.currency);
    formData.append('exchangeRate', String(payload.exchangeRate));
    formData.append('category', payload.category);
    formData.append('description', payload.description);
    formData.append('spentOn', payload.spentOn);
    if (payload.providerId) formData.append('providerId', payload.providerId);
    if (payload.activityId) formData.append('activityId', payload.activityId);
    if (payload.notes) formData.append('notes', payload.notes);

    return unwrap<ExpenseResponse>(apiClient.post(`${base(projectId)}/expenses`, formData));
  },

  updateExpense: (projectId: string, expenseId: string, payload: UpdateExpenseInput) =>
    unwrap<ExpenseResponse>(apiClient.patch(`${base(projectId)}/expenses/${expenseId}`, payload)),

  deleteExpense: (projectId: string, expenseId: string) =>
    unwrap<DeleteResponse>(apiClient.delete(`${base(projectId)}/expenses/${expenseId}`)),

  summary: (projectId: string) =>
    unwrap<FinanceSummaryResponse>(apiClient.get(`${base(projectId)}/summary`)),

  payroll: (projectId: string, from: string, to: string) =>
    unwrap<PayrollResponse>(
      apiClient.get(`${base(projectId)}/payroll?from=${from}&to=${to}`),
    ),
};
