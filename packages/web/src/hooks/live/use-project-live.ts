import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { liveApi } from '@/api/live';
import { createInvalidationBatcher } from '@/lib/live/invalidation-batcher';
import { createLiveConnection } from '@/lib/live/live-connection';
import { liveQueryKeysFor } from '@/lib/live/live-query-keys';
import { useAuth } from '@/providers/auth-provider';

/**
 * Tiempo real de la obra abierta: escucha avisos del servidor y vuelve a pedir
 * lo que cambió. Capa 2, montado **una sola vez** en `DashboardLayout`.
 *
 * El servidor no manda datos, sólo "cambió Actividades en esta obra"; acá se
 * invalida la caché de React Query y cada pantalla que esté mirando ese dato
 * lo vuelve a pedir por la API de siempre, que aplica los permisos del rol.
 *
 * Es un **extra sobre el polling**, no un reemplazo: si el stream no abre (un
 * proxy, un Safari viejo, el servidor saturado) o se cae sin avisar, las
 * pantallas siguen refrescándose solas cada tanto (ver `lib/query-freshness`).
 *
 * Una conexión por pestaña. Compartirla entre pestañas (Web Locks +
 * BroadcastChannel) es una optimización que hoy no se justifica: el servidor
 * ya limita las conexiones por persona.
 *
 * `data-live-status` en `<html>` deja ver el estado desde fuera (los E2E
 * esperan a `live` antes de provocar un cambio).
 */
export function useProjectLive(projectId: string | undefined): void {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !projectId) return;

    const batcher = createInvalidationBatcher({
      isBusy: () => queryClient.isMutating() > 0,
      flush: (resources) => {
        for (const key of liveQueryKeysFor(resources, projectId)) {
          // `cancelRefetch: false`: si ya hay un pedido en vuelo para esa
          // query, se lo deja terminar en vez de cancelarlo y repetirlo.
          void queryClient.invalidateQueries({ queryKey: [...key] }, { cancelRefetch: false });
        }
      },
    });

    const root = document.documentElement;
    const connection = createLiveConnection({
      open: (signal) => liveApi.open(projectId, signal),
      onInvalidate: (resources) => batcher.add(resources),
      onStatus: (status) => {
        root.dataset.liveStatus = status;
      },
    });

    const hidden = () => document.visibilityState === 'hidden';
    const onVisibilityChange = () => (hidden() ? connection.hide() : connection.show());
    // `pageshow` con `persisted`: la página vuelve del bfcache de Safari con el
    // stream muerto y sin ningún evento que lo diga.
    const onPageShow = (event: PageTransitionEvent) => connection.show({ force: event.persisted });
    const onPageHide = () => connection.hide();
    // Volvió la red: la conexión vieja no se puede dar por buena.
    const onOnline = () => connection.show({ force: true });

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('online', onOnline);

    connection.start();
    if (hidden()) connection.hide();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('online', onOnline);
      connection.stop();
      batcher.cancel();
      delete root.dataset.liveStatus;
    };
  }, [isAuthenticated, projectId, queryClient]);
}
