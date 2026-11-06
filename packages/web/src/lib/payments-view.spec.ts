import { describe, expect, it } from 'vitest';
import type { Payment } from '@luma/shared';
import {
  countActivePaymentFilters,
  filterPayments,
  groupPayments,
  NO_PAYMENT_FILTERS,
  sumPayments,
} from './payments-view';

function payment(partial: Partial<Payment> & { id: string }): Payment {
  return { method: 'transferencia', paidOn: '2026-10-21', amountInProjectCurrency: 10, ...partial } as Payment;
}

const sample = [
  payment({ id: '1', scheduleItemConcept: 'Anticipo', reference: 'TRF-123', amountInProjectCurrency: 500 }),
  payment({ id: '2', method: 'efectivo', paidOn: '2026-09-30', notes: 'Cañería extra', amountInProjectCurrency: 200 }),
  payment({ id: '3', paidOn: '2026-10-02', reference: 'TRF-124', amountInProjectCurrency: 300 }),
];

describe('filterPayments', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterPayments(sample, NO_PAYMENT_FILTERS)).toHaveLength(3);
  });

  it('busca en la cuota, la referencia y las notas, sin acentos', () => {
    expect(filterPayments(sample, { ...NO_PAYMENT_FILTERS, search: 'anticipo' }).map((p) => p.id)).toEqual(['1']);
    expect(filterPayments(sample, { ...NO_PAYMENT_FILTERS, search: 'trf-12' }).map((p) => p.id)).toEqual(['1', '3']);
    expect(filterPayments(sample, { ...NO_PAYMENT_FILTERS, search: 'caneria' }).map((p) => p.id)).toEqual(['2']);
  });

  it('filtra por método y por rango, con los extremos incluidos', () => {
    expect(filterPayments(sample, { ...NO_PAYMENT_FILTERS, method: 'efectivo' }).map((p) => p.id)).toEqual(['2']);
    expect(
      filterPayments(sample, { ...NO_PAYMENT_FILTERS, from: '2026-10-02', to: '2026-10-21' }).map((p) => p.id),
    ).toEqual(['1', '3']);
  });
});

describe('countActivePaymentFilters', () => {
  it('cuenta cada filtro puesto', () => {
    expect(countActivePaymentFilters(NO_PAYMENT_FILTERS)).toBe(0);
    expect(countActivePaymentFilters({ search: ' ', method: 'efectivo', from: '2026-10-01', to: '' })).toBe(2);
  });
});

describe('groupPayments', () => {
  it('por mes, del más reciente al más viejo, con el total de lo visible', () => {
    const groups = groupPayments(sample, 'month');
    expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-09']);
    expect(groups[0].total).toBe(800);
  });

  it('por día', () => {
    expect(groupPayments(sample, 'day').map((g) => g.key)).toEqual(['2026-10-21', '2026-10-02', '2026-09-30']);
  });

  it('por método', () => {
    expect(groupPayments(sample, 'method').map((g) => g.key)).toEqual(['efectivo', 'transferencia']);
  });
});

describe('sumPayments', () => {
  it('suma lo que recibe', () => {
    expect(sumPayments(sample)).toBe(1000);
  });
});
