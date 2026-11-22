import type { Expense, Payment } from '@luma/shared';
import type { SheetTable } from './google-sheets';
import { tableToCsv } from './materials';

/**
 * El CSV de un listado de movimientos de plata (gastos o cobros), para abrir en
 * Excel o en una planilla. Mismas reglas que el CSV de Compras: separador `;` y
 * decimales con coma (lo que Excel espera en español y portugués), BOM para que
 * los acentos no salgan rotos y `csvCell` para entrecomillar y neutralizar lo que
 * Excel tomaría por una fórmula (todo eso vive en `tableToCsv`).
 *
 * Lleva más que el PDF, que es para leer: acá va también el importe original, su
 * moneda y la cotización congelada de cada movimiento, para poder rehacer la
 * cuenta. Nada se reconvierte: el importe de la obra es el que ya tenía el
 * movimiento.
 */
export function buildMovementsCsv(header: string[], rows: string[][], separator = ';'): string {
  return tableToCsv({ header, rows }, String, separator);
}

interface CsvLabels {
  /** Número con el separador decimal del idioma y sin separador de miles. */
  number: (value: number) => string;
}

export interface ExpensesCsvLabels extends CsvLabels {
  header: {
    date: string;
    description: string;
    category: string;
    method: string;
    provider: string;
    activity: string;
    amount: string;
    currency: string;
    originalAmount: string;
    originalCurrency: string;
    rate: string;
    notes: string;
  };
  category: (category: Expense['category']) => string;
  method: (method: NonNullable<Expense['method']>) => string;
}

/** Los gastos como tabla: la usan el CSV y la Google Sheet. Los importes van como números. */
export function expensesTable(
  expenses: Expense[],
  projectCurrency: string,
  labels: Omit<ExpensesCsvLabels, 'number'>,
): SheetTable {
  const { header } = labels;
  return {
    header: [
      header.date,
      header.description,
      header.category,
      header.method,
      header.provider,
      header.activity,
      header.amount,
      header.currency,
      header.originalAmount,
      header.originalCurrency,
      header.rate,
      header.notes,
    ],
    rows: expenses.map((expense) => [
      expense.spentOn,
      expense.description,
      labels.category(expense.category),
      expense.method ? labels.method(expense.method) : '',
      expense.providerName ?? '',
      expense.activityName ?? '',
      expense.amountInProjectCurrency,
      projectCurrency,
      expense.amount,
      expense.currency,
      expense.exchangeRate,
      expense.notes ?? '',
    ]),
  };
}

export function buildExpensesCsv(expenses: Expense[], projectCurrency: string, labels: ExpensesCsvLabels): string {
  return tableToCsv(expensesTable(expenses, projectCurrency, labels), labels.number);
}

export interface PaymentsCsvLabels extends CsvLabels {
  header: {
    date: string;
    concept: string;
    method: string;
    reference: string;
    amount: string;
    currency: string;
    originalAmount: string;
    originalCurrency: string;
    rate: string;
    notes: string;
  };
  /** Lo que se dice de un cobro sin cuota: "A cuenta". */
  onAccount: string;
  method: (method: Payment['method']) => string;
}

/** Los cobros como tabla: la usan el CSV y la Google Sheet. Los importes van como números. */
export function paymentsTable(
  payments: Payment[],
  projectCurrency: string,
  labels: Omit<PaymentsCsvLabels, 'number'>,
): SheetTable {
  const { header } = labels;
  return {
    header: [
      header.date,
      header.concept,
      header.method,
      header.reference,
      header.amount,
      header.currency,
      header.originalAmount,
      header.originalCurrency,
      header.rate,
      header.notes,
    ],
    rows: payments.map((payment) => [
      payment.paidOn,
      payment.scheduleItemConcept ?? labels.onAccount,
      labels.method(payment.method),
      payment.reference ?? '',
      payment.amountInProjectCurrency,
      projectCurrency,
      payment.amount,
      payment.currency,
      payment.exchangeRate,
      payment.notes ?? '',
    ]),
  };
}

export function buildPaymentsCsv(payments: Payment[], projectCurrency: string, labels: PaymentsCsvLabels): string {
  return tableToCsv(paymentsTable(payments, projectCurrency, labels), labels.number);
}
