import type mongoose from 'mongoose';
import {
  roundMoney,
  sumInProjectCurrency,
  type ExpenseCategory,
  type PaymentScheduleStatus,
  type PaymentSummary,
  type ProjectFinanceSummary,
} from '@luma/shared';
import { Budget } from '../models/Budget.js';
import { Expense } from '../models/Expense.js';
import { Payment } from '../models/Payment.js';
import { PaymentScheduleItem } from '../models/PaymentScheduleItem.js';
import { committedForProject } from './commitment.service.js';

/**
 * Todo lo derivado de la plata de una obra.
 *
 * **Nada de esto se guarda.** Un saldo guardado es la garantía de que algún
 * día no va a coincidir con la suma de sus movimientos, y cuando eso pase
 * ninguno de los dos números va a ser confiable. Se recalcula siempre.
 *
 * Vive en un servicio porque lo necesitan tres lugares —el cronograma, el
 * resumen del gerente y el Consultor IA— y con tres copias una se
 * desactualiza. Mismo criterio que `commitment.service.ts`.
 *
 * Todas las cifras salen en la moneda de la obra: cada movimiento se convierte
 * con la cotización que tenía el día que pasó, nunca con la de hoy.
 */

/** Cuánto se cobró contra cada cuota, en la moneda de la obra. */
export async function paidByScheduleItem(
  projectId: mongoose.Types.ObjectId | string,
): Promise<Map<string, number>> {
  const payments = await Payment.find({ project: projectId, scheduleItem: { $ne: null } }).select(
    'scheduleItem amount exchangeRate',
  );

  const byItem = new Map<string, number>();
  for (const payment of payments) {
    const key = String(payment.scheduleItem);
    byItem.set(key, (byItem.get(key) ?? 0) + payment.amount * payment.exchangeRate);
  }

  for (const [key, value] of byItem) byItem.set(key, roundMoney(value));
  return byItem;
}

/**
 * En qué estado está una cuota. Derivado de lo cobrado, nunca guardado.
 *
 * `vencido` gana sobre `pendiente` pero **no** sobre `parcial`: una cuota a la
 * que se le pagó algo tarde sigue siendo una conversación distinta de una que
 * nadie tocó. Y una cuota cobrada no vence aunque la fecha haya pasado.
 */
export function scheduleItemStatus(
  scheduledAmount: number,
  paidAmount: number,
  dueOn: string,
  today: string,
): PaymentScheduleStatus {
  // Tolerancia de un centavo: sumar conversiones de monedas distintas puede
  // dejar la cuota a 0.004 de cerrar, y mostrarla como "parcial" para siempre
  // sería mentir por un error de redondeo.
  if (paidAmount >= scheduledAmount - 0.01) return 'cobrado';
  if (paidAmount > 0) return 'parcial';
  return dueOn < today ? 'vencido' : 'pendiente';
}

/** El resumen de cobros: lo que ve el cliente. Sin una sola cifra de gasto. */
export async function paymentSummaryFor(
  projectId: mongoose.Types.ObjectId | string,
  currency: string,
  today: string,
): Promise<PaymentSummary> {
  const [items, paid] = await Promise.all([
    PaymentScheduleItem.find({ project: projectId }).sort({ dueOn: 1, order: 1 }),
    paidByScheduleItem(projectId),
  ]);

  const scheduledTotal = sumInProjectCurrency(items);

  // El total cobrado incluye los cobros a cuenta, que no están imputados a
  // ninguna cuota: si sólo sumara `paid`, el saldo del cliente mostraría una
  // deuda que ya pagó.
  const allPayments = await Payment.find({ project: projectId }).select('amount exchangeRate');
  const paidTotal = sumInProjectCurrency(allPayments);

  const nextItem = items.find((item) => {
    const itemPaid = paid.get(String(item._id)) ?? 0;
    return scheduleItemStatus(roundMoney(item.amount * item.exchangeRate), itemPaid, item.dueOn, today) !== 'cobrado';
  });

  return {
    currency,
    scheduledTotal,
    paidTotal,
    // Puede dar negativo si el cliente pagó de más: mostrarlo como 0 taparía
    // justamente el caso que hay que devolver o imputar.
    pendingTotal: roundMoney(scheduledTotal - paidTotal),
    nextDue: nextItem
      ? {
          concept: nextItem.concept,
          dueOn: nextItem.dueOn,
          amount: roundMoney(nextItem.amount * nextItem.exchangeRate),
        }
      : undefined,
  };
}

/** El resumen completo, con gastos y margen. **Sólo para el gerente.** */
export async function financeSummaryFor(
  projectId: mongoose.Types.ObjectId | string,
  currency: string,
  today: string,
): Promise<ProjectFinanceSummary> {
  const [payments, expenses, committedTotal, budget] = await Promise.all([
    paymentSummaryFor(projectId, currency, today),
    Expense.find({ project: projectId }).select('category amount exchangeRate'),
    committedForProject(projectId),
    Budget.findOne({ project: projectId }).sort({ version: -1 }).select('totalAmount'),
  ]);

  const expensesByCategory = {
    material: 0,
    herramienta: 0,
    nomina: 0,
    insumo: 0,
    otro: 0,
  } as Record<ExpenseCategory, number>;

  for (const expense of expenses) {
    expensesByCategory[expense.category] += expense.amount * expense.exchangeRate;
  }
  for (const key of Object.keys(expensesByCategory) as ExpenseCategory[]) {
    expensesByCategory[key] = roundMoney(expensesByCategory[key]);
  }

  const expenseTotal = sumInProjectCurrency(expenses);

  return {
    ...payments,
    expenseTotal,
    expensesByCategory,
    committedTotal,
    budgetTotal: budget?.totalAmount ?? 0,
    // Cobrado menos gastado. Es la utilidad, y es la cifra que la regla 13
    // dice que el cliente no ve — por eso este resumen va con `expense.read`.
    marginTotal: roundMoney(payments.paidTotal - expenseTotal),
  };
}
