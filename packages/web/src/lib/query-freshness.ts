import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Cuán fresca tiene que estar cada lista de obra.
 *
 * El `staleTime` global (5 min, ver `app-provider.tsx`) sirve para datos que
 * sólo cambia quien los mira: el perfil, las tablas de plataforma. No sirve
 * para lo que **otra persona de la obra puede cambiar mientras vos mirás**:
 * en TanStack Query v5 el refetch al enfocar la pestaña o al volver a montar
 * una pantalla sólo ocurre si la query está vencida, así que con 5 minutos un
 * supervisor podía tardar hasta 5 minutos en ver lo que cargó el gerente.
 *
 * Dos niveles:
 *
 * - `POLLED_LIST`: vencida a los 30 s y, mientras la pantalla está a la vista,
 *   vuelve a pedirse cada 30 s. `refetchInterval` sólo corre en las queries
 *   **montadas**, así que cuesta lo que se está mirando y nada más. Con la
 *   pestaña en segundo plano se detiene, y al volver se pide sola.
 * - `FRESH_30S`: sólo vence a los 30 s, sin polling. Para lo que se mira
 *   siempre pero cambia poco (la obra misma): se actualiza al volver a la
 *   pestaña o al cambiar de pantalla.
 *
 * Actividades y Materiales además se avisan en vivo (`useProjectLive`); este
 * polling es la red de seguridad cuando el stream no abre o se cae sin
 * avisar —en iPhone pasa—.
 *
 * Cada refetch de una pantalla de obra cuesta unas cuatro consultas de
 * autorización en la API (`requireProjectAccess`): por eso no se baja de 30 s
 * ni se pollea lo que no se está mirando.
 */

export const LIST_STALE_MS = 30_000;
export const LIST_POLL_MS = 30_000;
/**
 * Polling de respaldo de las listas que **ya reciben avisos en vivo**
 * (Actividades, Materiales) cuando el canal está sano. Sigue existiendo porque
 * en iPhone el stream puede morir sin avisar, pero no hace falta pedir cada
 * 30 s lo que el servidor ya avisa: cada vuelta cuesta unas cuatro consultas
 * de autorización por cliente.
 */
export const LIVE_BACKUP_POLL_MS = 120_000;

/**
 * Lista de obra con polling. Con `live: true` (el canal en vivo está sano) se
 * espacia al respaldo; si el canal cae vuelve a `LIST_POLL_MS`, solo.
 */
export function polledList(live = false) {
  return {
    staleTime: LIST_STALE_MS,
    refetchInterval: live ? LIVE_BACKUP_POLL_MS : LIST_POLL_MS,
    refetchIntervalInBackground: false,
  } as const;
}

export const POLLED_LIST = polledList();

export const FRESH_30S = {
  staleTime: LIST_STALE_MS,
} as const;

/**
 * Clave de las mutaciones que escriben la caché de actividades **antes** de
 * que la API conteste (mover una tarjeta, mover una barra del Cronograma).
 */
export function optimisticActivityMutationKey(projectId: string) {
  return ['optimistic-activity', projectId] as const;
}

/**
 * Si hay una mutación optimista en vuelo, el dato que acaba de llegar es
 * anterior a ella —el servidor todavía no sabe del cambio— y pisaría la caché
 * optimista: la tarjeta saltaría a su lugar viejo hasta el siguiente refetch.
 * En ese caso se conserva lo que ya está en caché; la mutación invalida al
 * terminar y trae el dato bueno.
 */
export function keepWhileMutating<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  mutationKey: MutationKey,
  fetched: T,
): T {
  if (queryClient.isMutating({ mutationKey }) === 0) return fetched;
  return queryClient.getQueryData<T>(queryKey) ?? fetched;
}
