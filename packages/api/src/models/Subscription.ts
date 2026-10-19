import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { StripeSubscriptionStatus } from '@luma/shared';

/**
 * La suscripción de una Empresa a Luma. Una por Empresa; la paga su dueño.
 *
 * Guarda **hechos**, no estado: cuándo empezó la prueba, si se cortó antes
 * para crear la cuarta obra, y lo último que informó Stripe. Si está en
 * prueba, activa o vencida se deriva en `@luma/shared/billing` —un estado
 * guardado se desincroniza del reloj al día siguiente—.
 *
 * Que no exista el documento es un estado válido: `sin_iniciar`. Es el caso
 * de quien entró invitado a la obra de otro; su prueba arranca recién cuando
 * crea su primera obra propia.
 */
export interface ISubscription extends Document {
  organization: mongoose.Types.ObjectId;
  /** Quien paga: el dueño de la Empresa. */
  owner: mongoose.Types.ObjectId;
  trialStartedAt: Date;
  trialEndsAt: Date;
  /** Pagó para crear la cuarta obra durante la prueba: la prueba terminó acá. */
  trialEndedEarlyAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: StripeSubscriptionStatus | null;
  stripeCurrentPeriodStart: Date | null;
  stripeCurrentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trialStartedAt: { type: Date, required: true },
    trialEndsAt: { type: Date, required: true },
    trialEndedEarlyAt: { type: Date, default: null },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null, index: true },
    stripeStatus: { type: String, default: null },
    stripeCurrentPeriodStart: { type: Date, default: null },
    stripeCurrentPeriodEnd: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Subscription: Model<ISubscription> =
  (mongoose.models.Subscription as Model<ISubscription>) ??
  mongoose.model<ISubscription>('Subscription', subscriptionSchema);

export default Subscription;
