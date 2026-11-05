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

export const POLLED_LIST = {
  staleTime: LIST_STALE_MS,
  refetchInterval: LIST_POLL_MS,
  refetchIntervalInBackground: false,
} as const;

export const FRESH_30S = {
  staleTime: LIST_STALE_MS,
} as const;
