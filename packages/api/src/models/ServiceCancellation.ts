import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Pedido público de baja. No cierra la cuenta: quien administra Luma la
 * procesa, y la purga sigue el plazo de 90 días de la Política de Privacidad.
 */
export interface IServiceCancellation extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  reason: 'noLongerUse' | 'privacy' | 'security' | 'other';
  additionalInfo?: string;
  confirmed: true;
  createdAt: Date;
  updatedAt: Date;
}

const serviceCancellationSchema = new Schema<IServiceCancellation>(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    nationalId: { type: String, required: true, trim: true, maxlength: 40 },
    reason: {
      type: String,
      required: true,
      enum: ['noLongerUse', 'privacy', 'security', 'other'],
    },
    additionalInfo: { type: String, trim: true, maxlength: 2000 },
    confirmed: { type: Boolean, required: true },
  },
  { timestamps: true },
);

export const ServiceCancellation: Model<IServiceCancellation> =
  (mongoose.models.ServiceCancellation as Model<IServiceCancellation>) ??
  mongoose.model<IServiceCancellation>('ServiceCancellation', serviceCancellationSchema);
