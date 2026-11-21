const KEY = 'luma.firstProjectRedirect';

/** Por persona: con varias altas seguidas en la misma pestaña, cada una rebota una vez. */
const keyFor = (userId?: string) => (userId ? `${KEY}:${userId}` : KEY);

/**
 * El rebote del listado vacío al alta de obra ocurre una sola vez por sesión: si la persona
 * cancela y vuelve al listado, ve la invitación y no rebota otra vez. Sin `sessionStorage`
 * (modo privado, datos bloqueados) se cuenta como ya enviada, así nunca queda atrapada en un
 * bucle entre el listado y el alta.
 */
export function hasBeenSentToFirstProject(userId?: string): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(keyFor(userId)));
  } catch {
    return true;
  }
}

export function markSentToFirstProject(userId?: string): void {
  try {
    window.sessionStorage.setItem(keyFor(userId), '1');
  } catch {
    /* sin almacenamiento: no hay nada que recordar */
  }
}
