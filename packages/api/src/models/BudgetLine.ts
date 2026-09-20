import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { roundMoney } from '@luma/shared';

/**
 * Ítem de un `Budget` (RF-05, corte 1). `chapter` y `unit` son texto libre a
 * propósito: una planilla real trae capítulos y unidades que no entran en un
 * enum fijo. `total` es el valor que manda — nunca se recalcula server-side a
 * partir de `quantity * unitCost`.
 */
export interface IBudgetLine extends Document {
  budget: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  chapter: string;
  order: number;
  name: string;
  unit: string;
  quantity?: number;
  unitCost?: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

const budgetLineSchema = new Schema<IBudgetLine>(
  {
    budget: { type: Schema.Types.ObjectId, ref: 'Budget', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    chapter: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 0 },
    unitCost: { type: Number, min: 0 },
    total: { type: Number, required: true, min: 0, set: roundMoney },
  },
  { timestamps: true },
);

budgetLineSchema.index({ budget: 1, order: 1 });

export const BudgetLine: Model<IBudgetLine> =
  (mongoose.models.BudgetLine as Model<IBudgetLine>) ??
  mongoose.model<IBudgetLine>('BudgetLine', budgetLineSchema);

export default BudgetLine;
