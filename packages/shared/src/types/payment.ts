import type { MoneyAmount } from './money.js';

/**
 * La plata que se mueve en una obra, en dos flujos que la matriz de roles
 * trata distinto y que por eso **no comparten entidad**:
 *
 * - **Cobros** (cliente → gerente): el cronograma acordado y lo efectivamente
 *   recibido. El cliente los ve; son su fila "revisar cronograma de pagos
 *   acordado".
 * - **Gastos** (gerente → afuera): materiales, herramientas, nómina, insumos.
 *   El cliente **no** los ve. Están sólo en la fila del gerente, y es la regla
 *   13: la utilidad del ejecutante nunca es visible para el cliente — y la
 *   utilidad es exactamente cobros menos gastos.
 *
 * Si fueran una sola "sección de pagos", el cliente podría calcular el margen
 * restando. Van separados desde el modelo y no sólo desde la pantalla.
 */

/** Estado de una cuota, **derivado** de lo que se le imputó. Nunca se guarda. */
export type PaymentScheduleStatus = 'pendiente' | 'parcial' | 'cobrado' | 'vencido';

/** Una cuota del cronograma acordado con el cliente. */
export interface PaymentScheduleItem extends MoneyAmount {
  id: string;
  projectId: string;
  /** Orden en el cronograma: anticipo, avance 1, avance 2, saldo final. */
  order: number;
  concept: string;
  /** `YYYY-MM-DD` — ver CLAUDE.md sobre fechas y Safari. */
  dueOn: string;
  notes?: string;
  /** Suma de los cobros imputados, en la moneda de la obra. Derivado. */
  paidAmount: number;
  /** El monto de la cuota en la moneda de la obra. Derivado. */
  scheduledAmount: number;
  status: PaymentScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'transferencia' | 'efectivo' | 'cheque' | 'otro';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'transferencia',
  'efectivo',
  'cheque',
  'otro',
] as const;

/** Un cobro efectivamente recibido del cliente. */
export interface Payment extends MoneyAmount {
  id: string;
  projectId: string;
  /** Cuota a la que se imputa. Sin ella es un cobro a cuenta. */
  scheduleItemId?: string;
  scheduleItemConcept?: string;
  paidOn: string;
  method: PaymentMethod;
  /** Nº de transferencia, cheque o lo que sirva para encontrarlo después. */
  reference?: string;
  notes?: string;
  /** El cobro en la moneda de la obra. Derivado. */
  amountInProjectCurrency: number;
  registeredBy: string;
  registeredByName: string;
  createdAt: string;
}

/** Las cinco categorías de gasto que enumera la matriz. */
export type ExpenseCategory = 'material' | 'herramienta' | 'nomina' | 'insumo' | 'otro';

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'material',
  'herramienta',
  'nomina',
  'insumo',
  'otro',
] as const;

/** Comprobante de un gasto. Mismo storage que documentos y evidencia. */
export interface ExpenseReceipt {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** URL firmada, generada al vuelo. `null` si el storage no está configurado. */
  url: string | null;
}

/** Un egreso de la obra. **Nunca sale hacia el cliente.** */
export interface Expense extends MoneyAmount {
  id: string;
  projectId: string;
  category: ExpenseCategory;
  description: string;
  spentOn: string;
  providerId?: string;
  providerName?: string;
  activityId?: string;
  activityName?: string;
  receipt?: ExpenseReceipt;
  notes?: string;
  /** El gasto en la moneda de la obra. Derivado. */
  amountInProjectCurrency: number;
  registeredBy: string;
  registeredByName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * El resumen de cobros. Es lo que ve el cliente, y por eso **no tiene ni una
 * cifra de gasto**: con el total gastado y el total cobrado se despeja el
 * margen en una resta.
 */
export interface PaymentSummary {
  currency: string;
  scheduledTotal: number;
  paidTotal: number;
  pendingTotal: number;
  /** La próxima cuota que vence, si queda alguna. */
  nextDue?: { concept: string; dueOn: string; amount: number };
}

/** El resumen económico completo. **Sólo para el gerente.** */
export interface ProjectFinanceSummary extends PaymentSummary {
  expenseTotal: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  /** Comprometido con proveedores aprobados — ver `commitment.service.ts`. */
  committedTotal: number;
  budgetTotal: number;
  /** Cobrado menos gastado. La utilidad, que el cliente nunca ve. */
  marginTotal: number;
}

export interface PaymentScheduleListResponse {
  items: PaymentScheduleItem[];
  summary: PaymentSummary;
}

export interface PaymentScheduleItemResponse {
  item: PaymentScheduleItem;
}

export interface PaymentListResponse {
  payments: Payment[];
}

export interface PaymentResponse {
  payment: Payment;
}

export interface ExpenseListResponse {
  expenses: Expense[];
}

export interface ExpenseResponse {
  expense: Expense;
}

export interface FinanceSummaryResponse {
  summary: ProjectFinanceSummary;
}

export interface DeleteResponse {
  id: string;
}

/**
 * Nómina calculada, no cargada: quién vino, cuántos días, a cuánto el jornal.
 * Se deriva de `LaborRecord` × `CrewMember.dailyRate` y sirve para que el
 * gerente registre el gasto con un número que cierra con la asistencia.
 */
export interface PayrollLine {
  crewMemberId: string;
  name: string;
  daysPresent: number;
  dailyRate: number;
  total: number;
}

export interface PayrollSummary {
  from: string;
  to: string;
  currency: string;
  lines: PayrollLine[];
  total: number;
  /** Personas presentes sin jornal cargado: su costo no está en el total. */
  missingRateCount: number;
}

export interface PayrollResponse {
  payroll: PayrollSummary;
}
