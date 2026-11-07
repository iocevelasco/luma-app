import type { Payment } from '@luma/shared';
import { buildMovementsPdf } from './movements-pdf';
import { purchaseFileName } from './materials-pdf';

/**
 * El PDF del listado de cobros: lo que el cliente pagó, en la moneda de la obra
 * con la cotización que cada cobro ya tenía congelada. El armado de la hoja es el
 * de `movements-pdf.ts`.
 */

/** `cobros-casa-rivera-2026-10-24.pdf`. */
export function paymentsFileName(projectName: string, date: Date, extension: 'pdf' | 'csv' = 'pdf'): string {
  return purchaseFileName(projectName, date, 'cobros', extension);
}

export interface PaymentsPdfLabels {
  /** "Cobros". */
  title: string;
  /** "8 cobros", ya con su plural. */
  summary: string;
  filtered: string | null;
  columns: { date: string; concept: string; method: string; reference: string; amount: string };
  /** Lo que se dice de un cobro sin cuota: "A cuenta". */
  onAccount: string;
  total: string;
  generated: string;
  page: (page: number, total: number) => string;
  method: (method: Payment['method']) => string;
  day: (dayKey: string) => string;
  money: (amount: number) => string;
}

export function buildPaymentsPdf(input: {
  projectName: string;
  /** Ya en el orden en que se muestran. */
  payments: Payment[];
  total: number;
  labels: PaymentsPdfLabels;
}): Promise<Blob> {
  const { projectName, payments, total, labels } = input;
  return buildMovementsPdf({
    projectName,
    title: labels.title,
    summary: labels.summary,
    filtered: labels.filtered,
    columns: [
      labels.columns.date,
      labels.columns.concept,
      labels.columns.method,
      labels.columns.reference,
      labels.columns.amount,
    ],
    rows: payments.map((payment) => [
      labels.day(payment.paidOn),
      payment.scheduleItemConcept ?? labels.onAccount,
      labels.method(payment.method),
      payment.reference ?? '',
      labels.money(payment.amountInProjectCurrency),
    ]),
    widths: [22, undefined, 32, 36, 28],
    total: { label: labels.total, value: labels.money(total) },
    generated: labels.generated,
    page: labels.page,
  });
}
