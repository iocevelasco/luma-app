import { useCallback, useEffect, useState } from 'react';
import { EMPTY_ACTIVITY_FILTERS, type ActivityFilters } from '@/lib/activity-filters';
import {
  activityFiltersStorageKey,
  loadActivityFilters,
  saveActivityFilters,
} from '@/lib/activity-filters-storage';
import { useAuth } from '@/providers/auth-provider';

/**
 * Los filtros de Actividades de esta obra, para esta persona, recordados en el
 * navegador (ver `activity-filters-storage.ts`).
 *
 * Capa 2 sin red: no pide nada a la API, así que no lleva
 * `enabled: isAuthenticated`. Sin sesión no hay clave y los filtros viven sólo
 * en memoria.
 */
export function useActivityFilters(projectId: string | undefined) {
  const { user } = useAuth();
  const key = user && projectId ? activityFiltersStorageKey(user.id, projectId) : null;

  const [loadedKey, setLoadedKey] = useState(key);
  const [filters, setFilters] = useState<ActivityFilters>(() =>
    key ? loadActivityFilters(key) : EMPTY_ACTIVITY_FILTERS,
  );

  // Cambiar de obra (o de persona) con la pantalla montada: lo guardado de la
  // clave nueva reemplaza a lo que había, en el mismo render, para no mostrar
  // ni un cuadro con los filtros de la otra obra.
  if (key !== loadedKey) {
    setLoadedKey(key);
    setFilters(key ? loadActivityFilters(key) : EMPTY_ACTIVITY_FILTERS);
  }

  useEffect(() => {
    if (key && key === loadedKey) saveActivityFilters(key, filters);
  }, [key, loadedKey, filters]);

  const update = useCallback(
    (patch: Partial<ActivityFilters>) => setFilters((current) => ({ ...current, ...patch })),
    [],
  );
  const reset = useCallback(() => setFilters(EMPTY_ACTIVITY_FILTERS), []);

  return { filters, update, reset };
}
