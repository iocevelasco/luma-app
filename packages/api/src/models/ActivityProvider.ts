import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Tabla puente N:N entre `Activity` y `Provider`: una actividad puede tener
 * varios proveedores asignados, y un proveedor puede estar en varias
 * actividades. Mismo patrón que `OrganizationMember`/`ProjectClient`: índice
 * único compuesto en vez de un array embebido, para no reescribir el
 * documento completo en cada asignación.
 */
export interface IActivityProvider extends Document {
  activity: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  createdAt: Date;
}

const activityProviderSchema = new Schema<IActivityProvider>(
  {
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityProviderSchema.index({ activity: 1, provider: 1 }, { unique: true });

export const ActivityProvider: Model<IActivityProvider> =
  (mongoose.models.ActivityProvider as Model<IActivityProvider>) ??
  mongoose.model<IActivityProvider>('ActivityProvider', activityProviderSchema);

export default ActivityProvider;
