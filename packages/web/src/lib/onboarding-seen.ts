export type TourLevel = 'home' | 'project';

/** Lleva el id de la persona, así que no es una clave fija: `version-manager` preserva por prefijo. */
export const TOUR_STORAGE_PREFIX = 'luma.tour.';

/**
 * Cada nivel del recorrido de bienvenida se muestra una vez por persona y navegador. Es sólo
 * un recuerdo de "ya lo vi": no es un dato de negocio, así que no vive en la base. Sin
 * `localStorage` (modo privado, datos bloqueados) se cuenta como visto: mejor no mostrarlo que
 * mostrarlo en cada visita.
 */
export const tourStorageKey = (level: TourLevel, userId: string) =>
  level === 'home' ? `${TOUR_STORAGE_PREFIX}v1:${userId}` : `${TOUR_STORAGE_PREFIX}v1.project:${userId}`;

export function hasSeenTour(level: TourLevel, userId: string): boolean {
  try {
    return Boolean(window.localStorage.getItem(tourStorageKey(level, userId)));
  } catch {
    return true;
  }
}

export function markTourSeen(level: TourLevel, userId: string): void {
  try {
    window.localStorage.setItem(tourStorageKey(level, userId), new Date().toISOString());
  } catch {
    /* sin almacenamiento: no hay nada que recordar */
  }
}
