/**
 * Densidad de las listas de Actividades y Compras en un teléfono. `DESIGN.md` fija la fila en
 * `p-4` y 12 px de aire entre filas: en 375 px eso deja ~3 actividades por pantalla.
 * Acá se achica **sólo en mobile** (`max-sm:`) y sólo para Actividades y Compras, que es
 * donde se lee más seguido y en la obra; el resto de las listas conserva el sistema.
 */

/** La fila: 12 px de padding y de aire interno, en vez de 16 y 12. */
export const MOBILE_ROW = 'max-sm:gap-2 max-sm:p-3';

/** Entre filas de un mismo grupo: 8 px, en vez de 12. */
export const MOBILE_ROW_LIST = 'max-sm:gap-2';

/** Entre el rótulo del grupo y su primera fila: 8 px, en vez de 12. */
export const MOBILE_SECTION = 'max-sm:gap-2';

/** Entre grupos: 20 px, en vez de 32. */
export const MOBILE_SECTIONS = 'max-sm:gap-5';
