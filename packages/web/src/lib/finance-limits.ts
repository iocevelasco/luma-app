/**
 * Cuántos movimientos devuelve la API como máximo: es el `.limit()` de
 * `expense.controller.ts` y de `payment.controller.ts`. Si una lista llega a ese
 * número, probablemente hay más y la pantalla lo dice (los filtros y los totales
 * por grupo sólo ven lo que llegó). Hay que mantenerlos iguales a mano.
 */
export const FINANCE_LIST_LIMIT = { expenses: 300, payments: 200 } as const;
