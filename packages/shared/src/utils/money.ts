/**
 * Redondeo consistente a 2 decimales para todo lo que representa dinero.
 * Un helper único evita que el schema Zod y el modelo Mongoose redondeen cada
 * uno a su manera y un total deje de cerrar por un centavo.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
