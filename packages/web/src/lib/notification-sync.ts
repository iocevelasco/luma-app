import type { AppNotification, NotificationListResponse, NotificationType } from '@luma/shared';
import { QueryKeys } from '@/lib/query-keys';

/**
 * Qué refrescar cuando llega una notificación nueva.
 *
 * Una notificación ya es la prueba de que algo cambió en una obra (una tarea
 * arrancó, se publicó un hito). La bandeja se consulta cada 60 s de todos
 * modos: aprovechar esa misma respuesta para refrescar la pantalla correspondiente
 * no cuesta una request más y acerca el cambio al que lo tiene que ver.
 */
const QUERIES_BY_TYPE: Record<NotificationType, readonly QueryKeys[]> = {
  actividad_iniciada: [QueryKeys.activities],
  actividad_en_revision: [QueryKeys.activities],
  actividad_completada: [QueryKeys.activities],
  hito: [QueryKeys.milestones],
  eventualidad: [QueryKeys.milestones],
};

/**
 * Las claves `[query, projectId]` a invalidar por las notificaciones que
 * aparecieron entre `previous` y `next`. Sin `previous` (primera carga) no hay
 * nada que comparar y no se invalida: la pantalla acaba de pedir sus datos.
 */
export function queriesToRefreshForNew(
  previous: NotificationListResponse | undefined,
  next: NotificationListResponse,
): [QueryKeys, string][] {
  if (!previous) return [];

  const seen = new Set(previous.notifications.map((notification) => notification.id));
  const keys = new Map<string, [QueryKeys, string]>();

  for (const notification of next.notifications as AppNotification[]) {
    if (seen.has(notification.id)) continue;
    for (const query of QUERIES_BY_TYPE[notification.type] ?? []) {
      keys.set(`${query}:${notification.projectId}`, [query, notification.projectId]);
    }
  }

  return [...keys.values()];
}
