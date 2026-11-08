const KEY = 'luma.firstProjectRedirect';

/**
 * El rebote del listado vacío al alta de obra ocurre una sola vez por sesión: si la persona
 * cancela y vuelve al listado, ve la invitación y no rebota otra vez. Sin `sessionStorage`
 * (modo privado, datos bloqueados) se cuenta como ya enviada, así nunca queda atrapada en un
 * bucle entre el listado y el alta.
 */
export function hasBeenSentToFirstProject(): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(KEY));
  } catch {
    return true;
  }
}

export function markSentToFirstProject(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    /* sin almacenamiento: no hay nada que recordar */
  }
}
