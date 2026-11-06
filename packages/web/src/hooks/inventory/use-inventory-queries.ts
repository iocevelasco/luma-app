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
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-material-queries.ts`. */

/**
 * El stock cambia desde fuera de esta pantalla —Compras marca un material como
 * llegado, otra persona despacha desde su celular—, así que nunca se sirve
 * del caché al abrir: con el `staleTime` de 5 minutos del resto de la app, el
 * patio mostraría lo de hace un rato.
 */
const ALWAYS_REFETCH_ON_OPEN = 0;

export function useStock(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.stock, projectId],
    queryFn: () => inventoryApi.stock(projectId!),
    enabled: isAuthenticated && !!projectId,
    staleTime: ALWAYS_REFETCH_ON_OPEN,
  });
}

export function useStockMovements(projectId: string | undefined, filters: StockMovementQuery) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.stockMovements, projectId, filters],
    queryFn: () => inventoryApi.movements(projectId!, filters),
    enabled: isAuthenticated && !!projectId,
    staleTime: ALWAYS_REFETCH_ON_OPEN,
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
    staleTime: ALWAYS_REFETCH_ON_OPEN,
  });
}

/** La pantalla del Depósito General: de la Empresa, no de una obra. */
export function useMyDeposit() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.myDeposit],
    queryFn: () => inventoryApi.myDeposit(),
    enabled: isAuthenticated,
    staleTime: ALWAYS_REFETCH_ON_OPEN,
  });
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
