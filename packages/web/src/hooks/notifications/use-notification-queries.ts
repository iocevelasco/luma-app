import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/notifications';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

/** Cada cuánto vuelve a preguntar si llegó algo. */
const POLL_MS = 60_000;

/**
 * La bandeja y el contador del badge, en una sola query.
 *
 * Se refresca por polling y no por websocket: un aviso de obra no es un chat,
 * enterarse un minuto después no cambia nada, y un socket agrega una conexión
 * persistente que hay que reconectar, autenticar y mantener viva en el VPS.
 *
 * `refetchIntervalInBackground` queda en su default (`false`): una pestaña en
 * segundo plano deja de preguntar, y vuelve a hacerlo sola al enfocarla.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.notifications],
    queryFn: () => notificationsApi.list(),
    enabled: isAuthenticated,
    refetchInterval: POLL_MS,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(notificationId),
    // Sin toast: marcar leído es consecuencia de tocar el aviso, no una acción
    // que alguien haya pedido confirmar.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.notifications] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.notifications] });
    },
  });
}
