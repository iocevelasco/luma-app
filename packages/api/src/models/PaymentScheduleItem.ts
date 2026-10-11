import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { roundMoney } from '@luma/shared';

/**
 * Una cuota del cronograma de pagos acordado con el cliente: anticipo,
 * avances, saldo final.
 *
 * **No guarda estado ni monto cobrado.** Si guardara `paidAmount`, ese número
 * podría dejar de coincidir con la suma de los `Payment` imputados a la cuota
 * —y el día que no coincidan, ninguno de los dos es confiable—. Se calcula en
 * `finance.service.ts`.
 *
 * Lleva su propia moneda y cotización: una obra puede acordar el anticipo en
 * dólares y los avances en pesos. Ver `MoneyAmount` en shared.
 */
export interface IPaymentScheduleItem extends Document {
  project: mongoose.Types.ObjectId;
  order: number;
  concept: string;
  amount: number;
  currency: string;
  /** Cuántas unidades de la moneda de la obra vale UNA de `currency`. */
  exchangeRate: number;
  /** `YYYY-MM-DD`. Ver CLAUDE.md sobre fechas y Safari. */
  dueOn: string;
  notes?: string;
  /**
   * Cuándo se avisó del vencimiento próximo. Lo escribe el script
   * `notify-upcoming-payments.ts` y existe sólo para no avisar dos veces.
   */
  dueNotifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentScheduleItemSchema = new Schema<IPaymentScheduleItem>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    order: { type: Number, default: 0 },
    concept: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, set: roundMoney },
    currency: { type: String, required: true, uppercase: true, trim: true },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    dueOn: { type: String, required: true },
    notes: { type: String, trim: true },
    dueNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// El cronograma se lee en orden de vencimiento.
paymentScheduleItemSchema.index({ project: 1, dueOn: 1, order: 1 });

export const PaymentScheduleItem: Model<IPaymentScheduleItem> =
  (mongoose.models.PaymentScheduleItem as Model<IPaymentScheduleItem>) ??
  mongoose.model<IPaymentScheduleItem>('PaymentScheduleItem', paymentScheduleItemSchema);

export default PaymentScheduleItem;
