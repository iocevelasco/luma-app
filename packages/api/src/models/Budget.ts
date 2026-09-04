import mongoose, { Schema, Document } from 'mongoose';
import type { BudgetChapter, BudgetSource } from '@luma/shared';

/**
 * Presupuesto del proyecto (RF-05).
 *
 * La versión 1 es la LÍNEA BASE y nunca se pisa: una recarga posterior crea la
 * versión 2 y la 1 queda para comparar (regla de negocio 9). Por eso el
 * documento es inmutable en la práctica — se agrega, no se edita.
 */
export interface BudgetDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  version: number;
  is_baseline: boolean;
  source: BudgetSource;
  file_name?: string;
  currency: string;
  chapters: BudgetChapter[];
  total: number;
  imported_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const budgetItemSchema = new Schema(
  {
    code: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: 'un', trim: true },
    quantity: { type: Number, default: 0 },
    unit_price: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const budgetChapterSchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    items: { type: [budgetItemSchema], default: [] },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const budgetSchema = new Schema<BudgetDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    is_baseline: { type: Boolean, default: false },
    source: { type: String, enum: ['import', 'manual'], default: 'import' },
    file_name: { type: String, trim: true },
    currency: { type: String, default: 'ARS' },
    chapters: { type: [budgetChapterSchema], default: [] },
    total: { type: Number, default: 0 },
    imported_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

budgetSchema.index({ project_id: 1, version: -1 }, { unique: true });

export const BudgetModel = mongoose.model<BudgetDocument>('Budget', budgetSchema);
