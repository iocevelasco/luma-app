import {
  countActiveFilters,
  EMPTY_ACTIVITY_FILTERS,
  sanitizeActivityFilters,
  type ActivityFilters,
} from '@/lib/activity-filters';

/**
 * Los filtros de Actividades se guardan en `localStorage` para que la persona
 * los encuentre como los dejó.
 *
 * - **Por persona y por obra**: en una computadora compartida los filtros de
 *   uno no pueden ser los del siguiente, y los responsables y rubros de una
 *   obra no existen en otra.
 * - **Nunca fechas.** Un rango guardado hoy está mal mañana, y es el filtro
 *   más fácil de olvidar. Lo que se mira en el tiempo va por la vista.
 * - Todo acceso va en `try/catch`: en Safari con navegación privada, o con los
 *   datos del sitio bloqueados, el acceso a `localStorage` tira. La pantalla
 *   funciona igual; sólo que los filtros no se recuerdan.
 */
const PREFIX = 'luma:actividades:filtros';

export function activityFiltersStorageKey(userId: string, projectId: string): string {
  return `${PREFIX}:${userId}:${projectId}`;
}

function storage(): Storage | null {
  try {
    return typeof window.localStorage === 'object' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadActivityFilters(key: string): ActivityFilters {
  try {
    const raw = storage()?.getItem(key);
    return raw ? sanitizeActivityFilters(JSON.parse(raw)) : EMPTY_ACTIVITY_FILTERS;
  } catch {
    return EMPTY_ACTIVITY_FILTERS;
  }
}

/** Sin filtros puestos no se guarda nada: se borra la clave. */
export function saveActivityFilters(key: string, filters: ActivityFilters): void {
  try {
    const store = storage();
    if (!store) return;
    if (countActiveFilters(filters) === 0) store.removeItem(key);
    else store.setItem(key, JSON.stringify(filters));
  } catch {
    // Cuota llena o acceso bloqueado: se sigue sin recordar.
  }
}
