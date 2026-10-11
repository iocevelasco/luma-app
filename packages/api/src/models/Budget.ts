import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { roundMoney, type BudgetImportMode } from '@luma/shared';

/**
 * Presupuesto de una obra (RF-05, corte 1). `currency` se copia de
 * `Project.currency` al crear — la línea base queda congelada aunque el
 * proyecto cambie de moneda después. Índice único (project, version): en
 * este corte sólo existe la versión 1, y ese índice es lo que convierte un
 * reintento de red en un 409 en vez de un presupuesto duplicado.
 */
export interface IBudget extends Document {
  project: mongoose.Types.ObjectId;
  version: number;
  currency: string;
  totalAmount: number;
  contingencyAmount: number;
  importMode: BudgetImportMode;
  sourceFileName?: string;
  sourceRowCount?: number;
  importedBy: mongoose.Types.ObjectId;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const budgetSchema = new Schema<IBudget>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    currency: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0, set: roundMoney },
    contingencyAmount: { type: Number, default: 0, min: 0, set: roundMoney },
    importMode: { type: String, enum: ['manual', 'import'], required: true },
    sourceFileName: { type: String, trim: true },
    sourceRowCount: { type: Number, min: 1 },
    importedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    importedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

budgetSchema.index({ project: 1, version: 1 }, { unique: true });

export const Budget: Model<IBudget> =
  (mongoose.models.Budget as Model<IBudget>) ?? mongoose.model<IBudget>('Budget', budgetSchema);

export default Budget;
