import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  DEPOSIT_MOVEMENT_KINDS,
  STOCK_MOVEMENT_KINDS,
  type MaterialUnit,
  type StockMovementKind,
} from '@luma/shared';

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
 * **Depósito General.** Un traspaso son dos filas unidas por `transfer`: la de la
 * obra (`desincorporacion` o `importacion`) y la del Depósito
 * (`deposito_ingreso` / `deposito_egreso`), que **no tiene `project`**: el
 * stock del Depósito es de la Empresa, y no se va cuando se purga la obra que
 * lo mandó. El costo de referencia (`unitCost` + `currency`, en la moneda de la
 * obra de origen) se congela sólo en las filas del Depósito.
 *
 * `receiver` es una persona física por nombre, sin referencia: quien retira
 * del patio muchas veces no tiene cuenta en Luma.
 */
export interface IStockMovement extends Document {
  /** Ausente en las filas del Depósito General. */
  project?: mongoose.Types.ObjectId;
  /** La Empresa dueña del Depósito. Presente en traspasos y filas del Depósito. */
  organization?: mongoose.Types.ObjectId;
  /** Une las dos filas de un traspaso. */
  transfer?: mongoose.Types.ObjectId;
  /** `deposito_ingreso`: la obra que mandó el material. */
  originProject?: mongoose.Types.ObjectId;
  /** `deposito_egreso`: la obra que lo recibió. */
  destinationProject?: mongoose.Types.ObjectId;
  /** Costo de referencia congelado, en `currency`. Sólo filas del Depósito. */
  unitCost?: number;
  currency?: string;
  /**
   * Cotización del costo respecto de la moneda de la obra de origen, congelada en
   * la fila (regla 2 de Plata). Hoy siempre 1: el costo se guarda en esa moneda y
   * nunca se convierte, pero la fila ya dice con qué cotización se tomó.
   */
  exchangeRate?: number;
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
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      // Todo menos las filas del Depósito, que son de la Empresa.
      required: function (this: IStockMovement) {
        return !(DEPOSIT_MOVEMENT_KINDS as readonly string[]).includes(this.kind);
      },
      index: true,
    },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
    transfer: { type: Schema.Types.ObjectId },
    originProject: { type: Schema.Types.ObjectId, ref: 'Project' },
    destinationProject: { type: Schema.Types.ObjectId, ref: 'Project' },
    unitCost: { type: Number, min: 0 },
    currency: { type: String, uppercase: true, trim: true },
    exchangeRate: { type: Number, min: 0 },
    itemKey: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    unit: {
      type: String,
      enum: ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'],
      required: true,
    },
    kind: { type: String, enum: [...STOCK_MOVEMENT_KINDS], required: true },
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
stockMovementSchema.index({ organization: 1, kind: 1, occurredAt: -1 });
stockMovementSchema.index({ transfer: 1 });
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
