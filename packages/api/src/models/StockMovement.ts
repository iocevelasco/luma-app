import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { MaterialUnit, StockMovementKind } from '@luma/shared';

/**
 * Una línea del kardex de una obra: un hecho con fecha. NUNCA se edita ni se
 * borra —no hay endpoint que lo haga—; una corrección es otro movimiento
 * (una devolución, por ejemplo). Sólo se va junto con la obra
 * (`PROJECT_OWNED`).
 *
 * El stock no se guarda en ningún lado: se recalcula sumando estas líneas
 * (`summarizeStock` en `@luma/shared`).
 *
 * El material no es una entidad: se identifica por `itemKey`
 * (`stockItemKey`: nombre normalizado + unidad). `name` es el texto con que
 * entró por primera vez, sólo para mostrarlo.
 *
 * `receiver` es una persona física por nombre, sin referencia: quien retira
 * del patio muchas veces no tiene cuenta en Luma.
 */
export interface IStockMovement extends Document {
  project: mongoose.Types.ObjectId;
  itemKey: string;
  name: string;
  unit: MaterialUnit;
  kind: StockMovementKind;
  quantity: number;
  activity?: mongoose.Types.ObjectId | null;
  destination?: string;
  receiver?: string;
  reason?: string;
  note?: string;
  /** El material de Compras que originó una `compra`. Único por entrada. */
  material?: mongoose.Types.ObjectId | null;
  occurredAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    itemKey: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    unit: {
      type: String,
      enum: ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'],
      required: true,
    },
    kind: { type: String, enum: ['compra', 'devolucion', 'consumo', 'merma'], required: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    destination: { type: String, trim: true },
    receiver: { type: String, trim: true },
    reason: { type: String, trim: true },
    note: { type: String, trim: true },
    material: { type: Schema.Types.ObjectId, ref: 'MaterialItem', default: null },
    occurredAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ project: 1, occurredAt: -1 });
stockMovementSchema.index({ project: 1, itemKey: 1 });
// Una compra por material de Compras: es lo que hace idempotente generar la
// entrada, aunque dos requests lo intenten a la vez.
stockMovementSchema.index(
  { material: 1 },
  { unique: true, partialFilterExpression: { kind: 'compra' } },
);

export const StockMovement: Model<IStockMovement> =
  (mongoose.models.StockMovement as Model<IStockMovement>) ??
  mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);

export default StockMovement;
