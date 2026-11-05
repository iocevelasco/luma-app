import { describe, expect, it } from 'vitest';
import type { Expense } from '@luma/shared';
import {
  countActiveExpenseFilters,
  filterExpenses,
  groupExpenses,
  NO_EXPENSE_FILTERS,
} from './expenses-view';

function expense(partial: Partial<Expense> & { id: string }): Expense {
  return {
    category: 'material',
    description: 'Gasto',
    spentOn: '2026-10-21',
    amountInProjectCurrency: 10,
    ...partial,
  } as Expense;
}

const sample = [
  expense({ id: '1', description: 'Cañería de cobre', providerName: 'Ferretería Sol', providerId: 'p1', amountInProjectCurrency: 40 }),
  expense({ id: '2', description: 'Jornal', category: 'nomina', spentOn: '2026-09-30', amountInProjectCurrency: 100 }),
  expense({ id: '3', description: 'Cemento', providerName: 'Ferretería Sol', providerId: 'p1', activityName: 'Losa', activityId: 'a1', spentOn: '2026-10-02', amountInProjectCurrency: 25 }),
];

describe('filterExpenses', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterExpenses(sample, NO_EXPENSE_FILTERS)).toHaveLength(3);
  });

  it('busca sin acentos ni mayúsculas, también en proveedor y actividad', () => {
    expect(filterExpenses(sample, { ...NO_EXPENSE_FILTERS, search: 'caneria' }).map((e) => e.id)).toEqual(['1']);
    expect(filterExpenses(sample, { ...NO_EXPENSE_FILTERS, search: 'ferreteria' }).map((e) => e.id)).toEqual(['1', '3']);
    expect(filterExpenses(sample, { ...NO_EXPENSE_FILTERS, search: 'losa' }).map((e) => e.id)).toEqual(['3']);
  });

  it('filtra por categoría y por rango, con los extremos incluidos', () => {
    expect(filterExpenses(sample, { ...NO_EXPENSE_FILTERS, category: 'nomina' }).map((e) => e.id)).toEqual(['2']);
    expect(
      filterExpenses(sample, { ...NO_EXPENSE_FILTERS, from: '2026-10-02', to: '2026-10-21' }).map((e) => e.id),
    ).toEqual(['1', '3']);
  });
});

describe('countActiveExpenseFilters', () => {
  it('cuenta cada filtro puesto, sin contar búsqueda en blanco', () => {
    expect(countActiveExpenseFilters(NO_EXPENSE_FILTERS)).toBe(0);
    expect(countActiveExpenseFilters({ search: '  ', category: 'nomina', from: '2026-10-01', to: '' })).toBe(2);
  });
});

describe('groupExpenses', () => {
  it('por categoría, en el orden del producto y con el total de lo visible', () => {
    const groups = groupExpenses(sample, 'category');
    expect(groups.map((g) => g.key)).toEqual(['material', 'nomina']);
    expect(groups[0].total).toBe(65);
  });

  it('por proveedor deja "Sin proveedor" al final', () => {
    const groups = groupExpenses(sample, 'provider');
    expect(groups.map((g) => g.name)).toEqual(['Ferretería Sol', null]);
    expect(groups[0].expenses.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('por mes, del más reciente al más viejo', () => {
    expect(groupExpenses(sample, 'month').map((g) => g.key)).toEqual(['2026-10', '2026-09']);
  });
});
