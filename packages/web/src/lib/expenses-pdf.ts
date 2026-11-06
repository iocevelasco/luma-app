import type { Expense } from '@luma/shared';
import { buildMovementsPdf } from './movements-pdf';
import { purchaseFileName } from './materials-pdf';

/**
 * El PDF del listado de gastos. Los importes salen en la moneda de la obra —la
 * que ya congeló cada gasto con su cotización— y el total es la suma de ésos:
 * nada se reconvierte acá. El armado de la hoja es el de `movements-pdf.ts`.
 */

/** `gastos-casa-rivera-2026-10-24.pdf`: sin espacios ni acentos, que viajan mal por chat. */
export function expensesFileName(projectName: string, date: Date, extension: 'pdf' | 'csv' = 'pdf'): string {
  return purchaseFileName(projectName, date, 'gastos', extension);
}

export interface ExpensesPdfLabels {
  /** "Gastos". */
  title: string;
  /** "12 gastos", ya con su plural. */
  summary: string;
  /** "Con filtros aplicados": sólo si la hoja no es la lista completa. */
  filtered: string | null;
  columns: { date: string; description: string; category: string; detail: string; amount: string };
  total: string;
  /** "Generado el 24/10/2026 10:30". */
  generated: string;
  /** "Página 2 de 3". */
  page: (page: number, total: number) => string;
  category: (category: Expense['category']) => string;
  method: (method: NonNullable<Expense['method']>) => string;
  /** Un día `YYYY-MM-DD` como se lee en el idioma de la persona. */
  day: (dayKey: string) => string;
  /** Un importe en la moneda de la obra, ya con su símbolo. */
  money: (amount: number) => string;
}

export function buildExpensesPdf(input: {
  projectName: string;
  /** Ya en el orden en que se muestran. */
  expenses: Expense[];
  total: number;
  labels: ExpensesPdfLabels;
}): Promise<Blob> {
  const { projectName, expenses, total, labels } = input;
  return buildMovementsPdf({
    projectName,
    title: labels.title,
    summary: labels.summary,
    filtered: labels.filtered,
    columns: [
      labels.columns.date,
      labels.columns.description,
      labels.columns.category,
      labels.columns.detail,
      labels.columns.amount,
    ],
    rows: expenses.map((expense) => [
      labels.day(expense.spentOn),
      expense.description,
      labels.category(expense.category),
      [expense.method && labels.method(expense.method), expense.providerName, expense.activityName]
        .filter(Boolean)
        .join(' · '),
      labels.money(expense.amountInProjectCurrency),
    ]),
    widths: ['wrap', undefined, 26, 38, 'wrap'],
    total: { label: labels.total, value: labels.money(total) },
    generated: labels.generated,
    page: labels.page,
  });
}
