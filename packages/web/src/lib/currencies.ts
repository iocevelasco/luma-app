/**
 * Las monedas que se ofrecen al registrar un movimiento. El schema compartido
 * acepta cualquier código de 3 letras (`currencySchema`); esta lista es sólo lo
 * que se muestra en un selector, para no pedir que se tipee "USD" a mano.
 */
export const CURRENCY_OPTIONS = ['ARS', 'USD', 'EUR', 'VES', 'MXN', 'COP', 'CLP', 'PEN', 'BRL'] as const;

/**
 * Las opciones de un selector: la moneda de la obra primero —es la que casi
 * siempre se usa— y después las demás. Si el valor actual no está en la lista
 * (una obra en otra moneda) se suma, para que el selector nunca quede vacío.
 */
export function currencyChoices(projectCurrency: string, current?: string): string[] {
  return [...new Set([projectCurrency, current, ...CURRENCY_OPTIONS].filter((code): code is string => Boolean(code)))];
}
