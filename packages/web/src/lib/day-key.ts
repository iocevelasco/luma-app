/**
 * Un día calendario como string `YYYY-MM-DD`, y de vuelta a `Date`.
 *
 * Se guarda como string y no como `Date` a propósito: un `Date` arrastra hora y
 * zona, y en cuanto viaja al query string se convierte a UTC. Para un usuario
 * en Argentina, `new Date('2026-08-13')` es el 12 a las 21:00, así que un rango
 * "13 al 13" pedido desde el navegador terminaba trayendo el día equivocado.
 * Acá el día es un día, y la conversión a instante la hace el backend en la
 * zona del usuario. Y se parsea a mano, no con `new Date('YYYY-MM-DD')`, por
 * Safari (ver CLAUDE.md).
 */

/** `YYYY-MM-DD` en hora LOCAL. `toISOString()` daría el día anterior en UTC-3. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Un `YYYY-MM-DD` de vuelta a Date local (la medianoche de ese día). */
export function fromDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}
