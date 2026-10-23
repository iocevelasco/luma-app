import type { ActivityStatus } from '@luma/shared';

/** Orden en que se ofrecen en el filtro: el mismo del ciclo de una tarea. */
export const FILTERABLE_ACTIVITY_STATUSES: readonly ActivityStatus[] = [
  'pendiente',
  'en_curso',
  'en_revision',
  'completada',
  'cancelada',
];

/**
 * Lee `?status=pendiente,en_curso`. Un valor que no es un estado se descarta
 * en vez de vaciar la pantalla: un link viejo o mal copiado tiene que mostrar
 * algo. Vacío = sin filtro.
 */
export function parseStatusFilter(raw: string | null): ActivityStatus[] {
  if (!raw) return [];
  const requested = new Set(raw.split(','));
  return FILTERABLE_ACTIVITY_STATUSES.filter((status) => requested.has(status));
}

/** Inverso de `parseStatusFilter`; `null` saca el parámetro de la URL. */
export function serializeStatusFilter(statuses: readonly ActivityStatus[]): string | null {
  const selected = new Set(statuses);
  const ordered = FILTERABLE_ACTIVITY_STATUSES.filter((status) => selected.has(status));
  return ordered.length > 0 ? ordered.join(',') : null;
}
