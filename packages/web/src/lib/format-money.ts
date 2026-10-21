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

/**
 * Bolívares como se escriben en Venezuela: "Bs. 41.448,21".
 *
 * No va por `style: 'currency'` con `VES`: según el locale sale "VES 41.448,21"
 * o "Bs.S", y ninguno es como lo lee quien va a transferir. Los separadores sí
 * siguen el idioma de la interfaz.
 */
export function formatBolivares(amount: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Bs. ${number}`;
}

