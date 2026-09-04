import mongoose, { Schema, Document } from 'mongoose';
import type { MaterialStatus } from '@luma/shared';

/** Insumo requerido (RF-02): cantidad, unidad, estado y costo estimado. */
export interface MaterialDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  activity_id?: mongoose.Types.ObjectId | null;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  estimated_cost: number;
  actual_cost?: number | null;
  chapter_code?: string;
  notes?: string;
  created_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<MaterialDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    activity_id: { type: Schema.Types.ObjectId, ref: 'Activity', default: null, index: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'un', trim: true },
    status: {
      type: String,
      enum: ['pending', 'requested', 'purchased', 'on_site'],
      default: 'pending',
      index: true,
    },
    estimated_cost: { type: Number, default: 0, min: 0 },
    actual_cost: { type: Number, default: null, min: 0 },
    chapter_code: { type: String, trim: true },
    notes: { type: String, trim: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

materialSchema.index({ project_id: 1, status: 1 });

export const MaterialModel = mongoose.model<MaterialDocument>('Material', materialSchema);
