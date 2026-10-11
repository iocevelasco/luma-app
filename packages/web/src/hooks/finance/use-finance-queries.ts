import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateExpenseInput,
  CreatePaymentInput,
  CreatePaymentScheduleItemInput,
} from '@luma/shared';
import { financeApi } from '@/api/finance';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */


/**
 * Cobros y cronograma comparten caché: un cobro nuevo cambia el estado de su
 * cuota y el resumen, así que invalidar uno sin el otro deja la pantalla
 * mostrando un saldo viejo al lado de un cobro nuevo.
 */
function invalidatePayments(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.paymentSchedule, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.payments, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.financeSummary, projectId] });
}

export function usePaymentSchedule(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.paymentSchedule, projectId],
    queryFn: () => financeApi.schedule(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function usePayments(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.payments, projectId],
    queryFn: () => financeApi.payments(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateScheduleItem(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreatePaymentScheduleItemInput) =>
      financeApi.createScheduleItem(projectId, payload),
    onSuccess: () => {
      invalidatePayments(queryClient, projectId);
      toast.success(t('finance.scheduleCreated'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useDeleteScheduleItem(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (itemId: string) => financeApi.deleteScheduleItem(projectId, itemId),
    onSuccess: () => {
      invalidatePayments(queryClient, projectId);
      toast.success(t('finance.scheduleDeleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useCreatePayment(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreatePaymentInput) => financeApi.createPayment(projectId, payload),
    onSuccess: () => {
      invalidatePayments(queryClient, projectId);
      toast.success(t('finance.paymentCreated'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useDeletePayment(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (paymentId: string) => financeApi.deletePayment(projectId, paymentId),
    onSuccess: () => {
      invalidatePayments(queryClient, projectId);
      toast.success(t('finance.paymentDeleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

// ── Gastos ───────────────────────────────────────────────────────────────────

function invalidateExpenses(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.expenses, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.financeSummary, projectId] });
}

export function useExpenses(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.expenses, projectId],
    queryFn: () => financeApi.expenses(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useFinanceSummary(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.financeSummary, projectId],
    queryFn: () => financeApi.summary(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateExpense(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: ({ receipt, ...payload }: CreateExpenseInput & { receipt?: File | null }) =>
      financeApi.createExpense(projectId, payload, receipt),
    onSuccess: () => {
      invalidateExpenses(queryClient, projectId);
      toast.success(t('finance.expenseCreated'));
    },
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useDeleteExpense(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (expenseId: string) => financeApi.deleteExpense(projectId, expenseId),
    onSuccess: () => {
      invalidateExpenses(queryClient, projectId);
      toast.success(t('finance.expenseDeleted'));
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

/**
 * Nómina del rango. `enabled` sólo con las dos fechas: la API las exige, y
 * pedirla con `undefined` sería un 400 garantizado en cada render.
 */
export function usePayroll(projectId: string | undefined, from?: string, to?: string) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.payroll, projectId, from, to],
    queryFn: () => financeApi.payroll(projectId!, from!, to!),
    enabled: isAuthenticated && !!projectId && !!from && !!to,
  });
}
