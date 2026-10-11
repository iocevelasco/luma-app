/**
 * Formatea un monto con la moneda de la obra.
 *
 * `Project.currency` es un string libre en el schema compartido (no valida
 * ISO — la UI cura una lista, el contrato no la fija). Un código no-ISO hace
 * que `Intl.NumberFormat` tire `RangeError`, y sin el try/catch eso rompe toda
 * la pantalla en vez de sólo el número. El fallback es menos lindo pero nunca
 * revienta.
 */
export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
