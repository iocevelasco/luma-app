import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type {
  CreateStockMovementInput,
  ImportFromDepositInput,
  SendToDepositInput,
  StockMovementQuery,
} from '@luma/shared';
import { inventoryApi } from '@/api/inventory';
import { FRESH_30S, POLLED_LIST } from '@/lib/query-freshness';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-material-queries.ts`. */


export function useStock(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.stock, projectId],
    queryFn: () => inventoryApi.stock(projectId!),
    enabled: isAuthenticated && !!projectId,
    ...POLLED_LIST,
  });
}

export function useStockMovements(projectId: string | undefined, filters: StockMovementQuery) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.stockMovements, projectId, filters],
    queryFn: () => inventoryApi.movements(projectId!, filters),
    enabled: isAuthenticated && !!projectId,
    ...POLLED_LIST,
  });
}

/**
 * Un movimiento cambia el stock y suma una línea al kardex: se vuelven a pedir
 * las dos. Sin `onError`: se envía desde un formulario y el banner de
 * `FormShell` muestra la falla ahí mismo.
 */
export function useCreateStockMovement(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateStockMovementInput) =>
      inventoryApi.createMovement(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.stock, projectId] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.stockMovements, projectId] });
      toast.success(t('inventory.movement.saved'));
    },
  });
}

/** Lo que se puede traer del Depósito. Sólo se pide cuando se abre el panel de importar. */
export function useDepositForImport(projectId: string | undefined, enabled: boolean) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.deposit, projectId],
    queryFn: () => inventoryApi.deposit(projectId!),
    enabled: isAuthenticated && !!projectId && enabled,
    ...FRESH_30S,
  });
}

/** La pantalla del Depósito General: de la Empresa, no de una obra. */
export function useMyDeposit() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.myDeposit],
    queryFn: () => inventoryApi.myDeposit(),
    enabled: isAuthenticated,
    ...FRESH_30S,
  });
}

/**
 * Compras cambia el inventario sin pasar por acá: un material que llega a obra
 * entra al patio. Las mutaciones de estado de Compras lo avisan con esto, así
 * el stock ya está al día cuando se abre la pantalla.
 */
export function invalidateStock(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.stock, projectId] });
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.stockMovements, projectId] });
}

/** Un traspaso mueve el patio de la obra y el Depósito de la Empresa: se vuelve a pedir todo. */
function invalidateTransfer(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  for (const key of [QueryKeys.stock, QueryKeys.stockMovements, QueryKeys.deposit]) {
    void queryClient.invalidateQueries({ queryKey: [key, projectId] });
  }
  void queryClient.invalidateQueries({ queryKey: [QueryKeys.myDeposit] });
}

export function useSendToDeposit(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: SendToDepositInput) => inventoryApi.sendToDeposit(projectId, payload),
    onSuccess: () => {
      invalidateTransfer(queryClient, projectId);
      toast.success(t('inventory.deposit.sent'));
    },
  });
}

export function useImportFromDeposit(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ImportFromDepositInput) =>
      inventoryApi.importFromDeposit(projectId, payload),
    onSuccess: () => {
      invalidateTransfer(queryClient, projectId);
      // El flete es un gasto de la obra: Finanzas tiene que verlo.
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.expenses, projectId] });
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.financeSummary, projectId] });
      toast.success(t('inventory.deposit.imported'));
    },
  });
}
