import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Eventos de Stripe ya procesados. Stripe reintenta un webhook hasta que le
 * contestamos 2xx, y puede mandar el mismo evento dos veces aunque le hayamos
 * contestado: sin esto, un `invoice.paid` repetido registraría dos pagos.
 */
export interface IStripeEvent extends Document {
  eventId: string;
  type: string;
  receivedAt: Date;
}

const stripeEventSchema = new Schema<IStripeEvent>({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  receivedAt: { type: Date, required: true, default: Date.now },
});

// No hace falta guardarlos para siempre: Stripe no reintenta después de 3 días.
stripeEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const StripeEvent: Model<IStripeEvent> =
  (mongoose.models.StripeEvent as Model<IStripeEvent>) ??
  mongoose.model<IStripeEvent>('StripeEvent', stripeEventSchema);

export default StripeEvent;
