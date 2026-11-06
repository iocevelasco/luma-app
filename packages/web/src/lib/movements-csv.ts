import type { Expense, Payment } from '@luma/shared';
import { csvCell } from './materials';

/**
 * El CSV de un listado de movimientos de plata (gastos o cobros), para abrir en
 * Excel o en una planilla. Mismas reglas que el CSV de Compras: separador `;` y
 * decimales con coma (lo que Excel espera en español y portugués), BOM para que
 * los acentos no salgan rotos y `csvCell` para entrecomillar y neutralizar lo que
 * Excel tomaría por una fórmula.
 *
 * Lleva más que el PDF, que es para leer: acá va también el importe original, su
 * moneda y la cotización congelada de cada movimiento, para poder rehacer la
 * cuenta. Nada se reconvierte: el importe de la obra es el que ya tenía el
 * movimiento.
 */
export function buildMovementsCsv(header: string[], rows: string[][], separator = ';'): string {
  const line = (cells: string[]) => cells.map((cell) => csvCell(cell, separator)).join(separator);
  return '﻿' + [line(header), ...rows.map(line)].join('\r\n') + '\r\n';
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

export function buildExpensesCsv(expenses: Expense[], projectCurrency: string, labels: ExpensesCsvLabels): string {
  const { header } = labels;
  return buildMovementsCsv(
    [
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
    expenses.map((expense) => [
      expense.spentOn,
      expense.description,
      labels.category(expense.category),
      expense.method ? labels.method(expense.method) : '',
      expense.providerName ?? '',
      expense.activityName ?? '',
      labels.number(expense.amountInProjectCurrency),
      projectCurrency,
      labels.number(expense.amount),
      expense.currency,
      labels.number(expense.exchangeRate),
      expense.notes ?? '',
    ]),
  );
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

export function buildPaymentsCsv(payments: Payment[], projectCurrency: string, labels: PaymentsCsvLabels): string {
  const { header } = labels;
  return buildMovementsCsv(
    [
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
    payments.map((payment) => [
      payment.paidOn,
      payment.scheduleItemConcept ?? labels.onAccount,
      labels.method(payment.method),
      payment.reference ?? '',
      labels.number(payment.amountInProjectCurrency),
      projectCurrency,
      labels.number(payment.amount),
      payment.currency,
      labels.number(payment.exchangeRate),
      payment.notes ?? '',
    ]),
  );
}
