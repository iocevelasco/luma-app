import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationListResponse } from '@luma/shared';
import { notificationsApi } from '@/api/notifications';
import { QueryKeys } from '@/lib/query-keys';
import { queriesToRefreshForNew } from '@/lib/notification-sync';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-project-queries.ts`. */

/** Cada cuánto vuelve a preguntar si llegó algo. */
const POLL_MS = 60_000;

/**
 * La bandeja y el contador del badge, en una sola query.
 *
 * Se refresca por polling y no por el canal en vivo: un aviso de obra no es un
 * chat y enterarse un minuto después no cambia nada. El canal en vivo
 * (`useProjectLive`, ver `docs/adr/002-tiempo-real-por-obra.md`) existe para
 * Actividades y Materiales, donde dos personas trabajan sobre lo mismo; la
 * campanita queda como estaba.
 *
 * `refetchIntervalInBackground` queda en su default (`false`): una pestaña en
 * segundo plano deja de preguntar, y vuelve a hacerlo sola al enfocarla.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [QueryKeys.notifications],
    queryFn: async () => {
      const previous = queryClient.getQueryData<NotificationListResponse>([QueryKeys.notifications]);
      const next = await notificationsApi.list();
      // Un aviso nuevo es la prueba de que algo cambió en una obra: se refresca
      // esa pantalla sin esperar a su propio polling.
      for (const key of queriesToRefreshForNew(previous, next)) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
      return next;
    },
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
