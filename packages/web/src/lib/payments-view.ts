import type { Payment, PaymentMethod } from '@luma/shared';

/**
 * Cómo se mira la lista de cobros: qué se deja y cómo se agrupa. Es el mismo
 * criterio que `expenses-view.ts` para los gastos, con lo que tiene un cobro: el
 * método de pago en vez de la categoría, y el concepto de la cuota en vez del
 * proveedor o la actividad.
 *
 * Todo en el cliente y sobre la lista que ya llegó. Los totales salen de las
 * filas visibles, no del resumen de la obra.
 */

export type PaymentGroupBy = 'month' | 'day' | 'method';

export const PAYMENT_GROUP_BY: readonly PaymentGroupBy[] = ['month', 'day', 'method'];

export interface PaymentFilters {
  search: string;
  method: PaymentMethod | 'all';
  /** `YYYY-MM-DD`, o '' sin tope. */
  from: string;
  to: string;
}

export const NO_PAYMENT_FILTERS: PaymentFilters = { search: '', method: 'all', from: '', to: '' };

export function countActivePaymentFilters(filters: PaymentFilters): number {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.method !== 'all' ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

/** Sin mayúsculas ni acentos. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function filterPayments(payments: Payment[], filters: PaymentFilters): Payment[] {
  const query = normalize(filters.search.trim());
  return payments.filter((payment) => {
    if (filters.method !== 'all' && payment.method !== filters.method) return false;
    // Los días son strings `YYYY-MM-DD`: comparar como texto es comparar fechas.
    if (filters.from && payment.paidOn < filters.from) return false;
    if (filters.to && payment.paidOn > filters.to) return false;
    if (!query) return true;
    return [payment.scheduleItemConcept, payment.reference, payment.notes]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalize(value).includes(query));
  });
}

export interface PaymentGroup {
  /** Estable entre renders: el mes, el día o el método. */
  key: string;
  payments: Payment[];
  /** Suma de lo visible, en la moneda de la obra. */
  total: number;
}

export function sumPayments(payments: Payment[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountInProjectCurrency, 0);
}

/** Agrupa por una sola dimensión. Mes y día, del más reciente al más viejo; método por nombre. */
export function groupPayments(payments: Payment[], by: PaymentGroupBy): PaymentGroup[] {
  const groups = new Map<string, PaymentGroup>();

  for (const payment of payments) {
    const key = by === 'month' ? payment.paidOn.slice(0, 7) : by === 'day' ? payment.paidOn : payment.method;
    const group = groups.get(key) ?? { key, payments: [], total: 0 };
    group.payments.push(payment);
    groups.set(key, group);
  }

  const result = [...groups.values()].map((group) => ({ ...group, total: sumPayments(group.payments) }));
  return result.sort((a, b) => (by === 'method' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key)));
}
