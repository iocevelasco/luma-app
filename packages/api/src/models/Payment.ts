import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { PAYMENT_METHODS, roundMoney, type PaymentMethod } from '@luma/shared';

/**
 * Un cobro efectivamente recibido del cliente.
 *
 * **Nunca se edita, sólo se crea o se borra.** Un cobro es un hecho con fecha:
 * corregirle el monto in situ borra lo que de verdad pasó y deja el saldo
 * cuadrando con una historia que nadie vivió. Si se cargó mal, se borra y se
 * carga de nuevo — y el borrado queda a la vista porque el total cambia.
 *
 * `scheduleItem` opcional: un cobro a cuenta, sin cuota asignada, es normal al
 * principio de una obra.
 */
export interface IPayment extends Document {
  project: mongoose.Types.ObjectId;
  scheduleItem?: mongoose.Types.ObjectId | null;
  amount: number;
  currency: string;
  exchangeRate: number;
  /** `YYYY-MM-DD`. */
  paidOn: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  registeredBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    scheduleItem: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentScheduleItem',
      default: null,
      index: true,
    },
    amount: { type: Number, required: true, min: 0, set: roundMoney },
    currency: { type: String, required: true, uppercase: true, trim: true },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    paidOn: { type: String, required: true },
    method: { type: String, enum: [...PAYMENT_METHODS], required: true },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    registeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

paymentSchema.index({ project: 1, paidOn: -1 });

export const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment>) ??
  mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
