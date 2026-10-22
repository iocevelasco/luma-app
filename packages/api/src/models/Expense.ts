import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { EXPENSE_CATEGORIES, roundMoney, type ExpenseCategory } from '@luma/shared';

/** Comprobante: factura o remito. Mismo storage que documentos y evidencia. */
export interface IExpenseReceipt {
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Un egreso de la obra: material, herramienta, nómina, insumo u otro.
 *
 * **Nunca sale hacia el cliente.** No es una regla de la pantalla sino del
 * modelo: está sólo en la fila del gerente de la matriz, y con el total
 * cobrado y el total gastado la utilidad del ejecutante sale de una resta
 * (regla 13). Las rutas van con `expense.read`, que el cliente no tiene.
 *
 * `provider` y `activity` son opcionales y sirven para responder "cuánto
 * llevamos gastado con el electricista" y "cuánto costó la cocina" sin
 * inventar un modelo de imputación aparte.
 *
 * `materials` es la factura cargada desde Compras: los materiales que paga.
 * Es el mismo gasto que ve Finanzas —una carga, dos lugares donde se ve—, no
 * un modelo de factura aparte que contaría la misma plata dos veces.
 */
export interface IExpense extends Document {
  project: mongoose.Types.ObjectId;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  /** `YYYY-MM-DD`. */
  spentOn: string;
  provider?: mongoose.Types.ObjectId | null;
  activity?: mongoose.Types.ObjectId | null;
  receipt?: IExpenseReceipt | null;
  materials: mongoose.Types.ObjectId[];
  notes?: string;
  registeredBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseReceiptSchema = new Schema<IExpenseReceipt>(
  {
    key: { type: String, required: true },
    fileName: { type: String, required: true, trim: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false },
);

const expenseSchema = new Schema<IExpense>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    category: { type: String, enum: [...EXPENSE_CATEGORIES], required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, set: roundMoney },
    currency: { type: String, required: true, uppercase: true, trim: true },
    exchangeRate: { type: Number, required: true, min: 0, default: 1 },
    spentOn: { type: String, required: true },
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', default: null, index: true },
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null, index: true },
    receipt: { type: expenseReceiptSchema, default: null },
    materials: { type: [{ type: Schema.Types.ObjectId, ref: 'MaterialItem' }], default: [], index: true },
    notes: { type: String, trim: true },
    registeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

expenseSchema.index({ project: 1, spentOn: -1 });
expenseSchema.index({ project: 1, category: 1 });

export const Expense: Model<IExpense> =
  (mongoose.models.Expense as Model<IExpense>) ??
  mongoose.model<IExpense>('Expense', expenseSchema);

export default Expense;
