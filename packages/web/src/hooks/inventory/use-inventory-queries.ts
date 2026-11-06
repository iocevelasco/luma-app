import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateStockMovementInput, StockMovementQuery } from '@luma/shared';
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
