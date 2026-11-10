import type { PaymentMethod } from '@luma/shared';

/**
 * Los métodos de pago en orden alfabético **del idioma de la pantalla**: el
 * orden sale de la etiqueta traducida, no de la clave (`efectivo` es «Dinheiro»
 * en portugués). «Otro» va siempre al final: es el comodín de lo que no está.
 */
export function sortPaymentMethods(
  methods: readonly PaymentMethod[],
  label: (method: PaymentMethod) => string,
  locale: string,
): PaymentMethod[] {
  return [...methods].sort((a, b) => {
    if (a === 'otro') return b === 'otro' ? 0 : 1;
    if (b === 'otro') return -1;
    return label(a).localeCompare(label(b), locale, { sensitivity: 'base' });
  });
}
