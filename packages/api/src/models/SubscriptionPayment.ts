import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type {
  ChargeLine,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
} from '@luma/shared';
import { roundMoney } from '@luma/shared';

/**
 * Un período de la suscripción pagado (o que alguien dice haber pagado).
 *
 * No confundir con `Payment`, que es un cobro de una OBRA al cliente. Esto es
 * plata que entra a Luma.
 *
 * Todo lo que define cuánto se pagó queda **congelado** al crear el registro:
 * el desglose en dólares, la tasa BCV y el monto en Bs. Mismo criterio que
 * los cobros y gastos de obra: un pago de octubre vale lo que valía en
 * octubre, y recalcularlo con la tasa de hoy haría que el historial cambie
 * solo.
 */
export interface IReceipt {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ISubscriptionPayment extends Document {
  organization: mongoose.Types.ObjectId;
  method: SubscriptionPaymentMethod;
  /** Un hecho que decide una persona (o Stripe), no un estado derivado. */
  status: SubscriptionPaymentStatus;
  periodStart: Date;
  periodEnd: Date;
  /** Pagó durante la prueba para crear la cuarta obra: corta la prueba. */
  activatesNow: boolean;

  lines: ChargeLine[];
  totalUsd: number;

  // Sólo en bolívares.
  bcvRate: number | null;
  rateValueDate: string | null;
  /** Lo que la API cotizó: `totalUsd × bcvRate`. */
  amountBs: number | null;
  /** Lo que la persona dice que transfirió. Se contrasta con `amountBs` al revisar. */
  declaredAmountBs: number | null;
  bank: string | null;
  reference: string | null;
  payerId: string | null;
  paidOn: string | null;
  receipt: IReceipt | null;

  // Sólo en Stripe.
  stripeInvoiceId: string | null;

  submittedBy: mongoose.Types.ObjectId | null;
  submittedAt: Date;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function roundMoneyOrNull(value: number | null): number | null {
  return value == null ? value : roundMoney(value);
}

const chargeLineSchema = new Schema<ChargeLine>(
  {
    kind: { type: String, enum: ['base', 'extra', 'prorrateo'], required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitUsd: { type: Number, required: true, min: 0 },
    // Sin `min: 0`: un prorrateo de Stripe puede ser un crédito.
    amountUsd: { type: Number, required: true, set: roundMoney },
    projectId: { type: String },
    days: { type: Number },
  },
  { _id: false },
);

const receiptSchema = new Schema<IReceipt>(
  {
    key: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false },
);

const subscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    method: { type: String, enum: ['stripe', 'pago_movil', 'transferencia'], required: true },
    status: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      required: true,
      default: 'pendiente',
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    activatesNow: { type: Boolean, default: false },

    lines: { type: [chargeLineSchema], default: [] },
    totalUsd: { type: Number, required: true, min: 0, set: roundMoney },

    bcvRate: { type: Number, default: null },
    rateValueDate: { type: String, default: null },
    amountBs: { type: Number, default: null, set: roundMoneyOrNull },
    declaredAmountBs: { type: Number, default: null, set: roundMoneyOrNull },
    bank: { type: String, default: null, trim: true },
    reference: { type: String, default: null, trim: true },
    payerId: { type: String, default: null, trim: true, uppercase: true },
    paidOn: { type: String, default: null },
    receipt: { type: receiptSchema, default: null },

    stripeInvoiceId: { type: String, default: null },

    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, required: true, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

subscriptionPaymentSchema.index({ organization: 1, periodStart: -1 });
// La cola de revisión del admin.
subscriptionPaymentSchema.index({ status: 1, submittedAt: 1 });
// El mismo comprobante no se usa dos veces. Sólo entre pagos vivos: si uno se
// rechazó (pagó de menos, por ejemplo) y lo vuelve a mandar corregido, la
// referencia del banco es la misma y tiene que poder. Los de Stripe no tienen
// banco ni referencia y quedan afuera solos. El controller normaliza `bank`.
subscriptionPaymentSchema.index(
  { bank: 1, reference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reference: { $type: 'string' },
      status: { $in: ['pendiente', 'aprobado'] },
    },
  },
);
// Un mismo evento de Stripe no registra dos pagos.
subscriptionPaymentSchema.index(
  { stripeInvoiceId: 1 },
  { unique: true, partialFilterExpression: { stripeInvoiceId: { $type: 'string' } } },
);

export const SubscriptionPayment: Model<ISubscriptionPayment> =
  (mongoose.models.SubscriptionPayment as Model<ISubscriptionPayment>) ??
  mongoose.model<ISubscriptionPayment>('SubscriptionPayment', subscriptionPaymentSchema);

export default SubscriptionPayment;
