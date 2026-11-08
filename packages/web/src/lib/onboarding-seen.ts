export type TourLevel = 'home' | 'project';

/**
 * Cada nivel del recorrido de bienvenida se muestra una vez por persona y navegador. Es sólo
 * un recuerdo de "ya lo vi": no es un dato de negocio, así que no vive en la base. Sin
 * `localStorage` (modo privado, datos bloqueados) se cuenta como visto: mejor no mostrarlo que
 * mostrarlo en cada visita.
 */
export const tourStorageKey = (level: TourLevel, userId: string) =>
  level === 'home' ? `luma.tour.v1:${userId}` : `luma.tour.v1.project:${userId}`;

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
