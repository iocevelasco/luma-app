/**
 * Dinero que se movió de verdad, en la moneda en la que se movió.
 *
 * Toda obra tiene una moneda (`Project.currency`), pero una remodelación
 * cotiza materiales en dólares y paga jornales en pesos. Por eso cada
 * movimiento lleva **su** moneda y la cotización del día en que pasó.
 *
 * `exchangeRate` es cuántas unidades de la moneda de la obra vale UNA unidad
 * de `currency`. Si son la misma, es `1`.
 *
 * La cotización se congela en el movimiento y no se recalcula nunca: un gasto
 * de agosto vale lo que valía en agosto, y reconvertirlo con la cotización de
 * hoy haría que el total de una obra cerrada cambie solo.
 */
export interface MoneyAmount {
  amount: number;
  currency: string;
  exchangeRate: number;
}

/**
 * El monto llevado a la moneda de la obra.
 *
 * Se calcula, no se guarda: con `amount` y `exchangeRate` adentro, el valor
 * derivado no puede divergir de sus partes. Un campo guardado sí puede.
 */
export function toProjectCurrency(money: MoneyAmount): number {
  return Math.round((money.amount * money.exchangeRate + Number.EPSILON) * 100) / 100;
}

/** Suma en la moneda de la obra. Convierte cada ítem antes de sumar, nunca después. */
export function sumInProjectCurrency(items: readonly MoneyAmount[]): number {
  return Math.round(
    (items.reduce((total, item) => total + item.amount * item.exchangeRate, 0) + Number.EPSILON) *
      100,
  ) / 100;
}
