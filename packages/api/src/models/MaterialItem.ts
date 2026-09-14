import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { MaterialStatus, MaterialUnit } from '@luma/shared';

/**
 * Ítem de materiales de una obra (RF-02), opcionalmente asociado a una
 * `Activity` de la misma obra. Borrado DURO. Las transiciones de `status` son
 * libres en el backend — la confirmación es sólo fricción de UI.
 */
export interface IMaterialItem extends Document {
  project: mongoose.Types.ObjectId;
  activity?: mongoose.Types.ObjectId | null;
  name: string;
  quantity: number;
  unit: MaterialUnit;
  status: MaterialStatus;
  statusChangedBy?: mongoose.Types.ObjectId;
  statusChangedAt?: Date;
  estimatedCost?: number;
  supplier?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const materialItemSchema = new Schema<IMaterialItem>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    activity: {
      type: Schema.Types.ObjectId,
      ref: 'Activity',
      required: false,
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit: {
      type: String,
      enum: ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pendiente', 'solicitado', 'comprado', 'en_obra'],
      default: 'pendiente',
    },
    statusChangedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    statusChangedAt: { type: Date },
    estimatedCost: { type: Number, min: 0 },
    supplier: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

materialItemSchema.index({ project: 1, status: 1 });

export const MaterialItem: Model<IMaterialItem> =
  (mongoose.models.MaterialItem as Model<IMaterialItem>) ??
  mongoose.model<IMaterialItem>('MaterialItem', materialItemSchema);

export default MaterialItem;
