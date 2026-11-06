import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from '@luma/shared';

/**
 * Cómo se mira la lista de gastos: qué se deja y cómo se agrupa. Todo en el
 * cliente y sobre la lista que ya llegó; nada de esto se guarda ni toca la API.
 *
 * Los totales salen de las filas visibles, no del resumen de la obra: si no, el
 * total de un grupo filtrado diría una cifra que la pantalla no muestra.
 */

export type ExpenseGroupBy = 'category' | 'provider' | 'activity' | 'month' | 'day';

export const EXPENSE_GROUP_BY: readonly ExpenseGroupBy[] = ['category', 'provider', 'activity', 'month', 'day'];

export interface ExpenseFilters {
  search: string;
  category: ExpenseCategory | 'all';
  /** `YYYY-MM-DD`, o '' sin tope. */
  from: string;
  to: string;
}

export const NO_EXPENSE_FILTERS: ExpenseFilters = { search: '', category: 'all', from: '', to: '' };

export function countActiveExpenseFilters(filters: ExpenseFilters): number {
  return (
    (filters.search.trim() ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0)
  );
}

/** Sin mayúsculas ni acentos: "cañeria" encuentra "Cañería". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function filterExpenses(expenses: Expense[], filters: ExpenseFilters): Expense[] {
  const query = normalize(filters.search.trim());
  return expenses.filter((expense) => {
    if (filters.category !== 'all' && expense.category !== filters.category) return false;
    // Los días son strings `YYYY-MM-DD`: comparar como texto es comparar fechas.
    if (filters.from && expense.spentOn < filters.from) return false;
    if (filters.to && expense.spentOn > filters.to) return false;
    if (!query) return true;
    return [expense.description, expense.providerName, expense.activityName, expense.notes]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalize(value).includes(query));
  });
}

export interface ExpenseGroup {
  /** Estable entre renders: la categoría, el proveedor, la actividad o el mes. */
  key: string;
  /** El nombre a mostrar, o `null` si es el grupo "Sin …" (lo rotula la pantalla). */
  name: string | null;
  expenses: Expense[];
  /** Suma de lo visible, en la moneda de la obra. */
  total: number;
}

function sumOf(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amountInProjectCurrency, 0);
}

/**
 * Agrupa por una sola dimensión. Orden: categorías en el orden del producto;
 * proveedor y actividad por nombre; mes del más reciente al más viejo. El grupo
 * "Sin …" va siempre al final.
 */
export function groupExpenses(expenses: Expense[], by: ExpenseGroupBy): ExpenseGroup[] {
  const groups = new Map<string, ExpenseGroup>();

  for (const expense of expenses) {
    let key: string;
    let name: string | null;
    switch (by) {
      case 'category':
        key = expense.category;
        name = expense.category;
        break;
      case 'provider':
        name = expense.providerName ?? null;
        key = name ? `provider:${expense.providerId ?? name}` : 'none';
        break;
      case 'activity':
        name = expense.activityName ?? null;
        key = name ? `activity:${expense.activityId ?? name}` : 'none';
        break;
      case 'month':
        key = expense.spentOn.slice(0, 7);
        name = key;
        break;
      case 'day':
        key = expense.spentOn;
        name = key;
        break;
    }
    const group = groups.get(key) ?? { key, name, expenses: [], total: 0 };
    group.expenses.push(expense);
    groups.set(key, group);
  }

  const result = [...groups.values()].map((group) => ({ ...group, total: sumOf(group.expenses) }));

  return result.sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    switch (by) {
      case 'category':
        return (
          EXPENSE_CATEGORIES.indexOf(a.name as ExpenseCategory) -
          EXPENSE_CATEGORIES.indexOf(b.name as ExpenseCategory)
        );
      case 'month':
      case 'day':
        return b.key.localeCompare(a.key);
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

export { sumOf as sumExpenses };
