import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { MaterialStatus, MaterialUnit } from '@luma/shared';

/**
 * Ítem de materiales de una obra (RF-02), opcionalmente asociado a una
 * `Activity` de la misma obra. Borrado DURO.
 *
 * Las transiciones de `status` son libres en el backend. Lo que NO es libre es
 * corregir el material —editarlo o eliminarlo—: sólo se puede mientras nunca
 * salió de Pendiente (`isMaterialEditable` en `@luma/shared`).
 *
 * Lo referencia una sola cosa: la factura (`Expense.materials`). El borrado
 * duro sigue sin dejar nada colgando porque sólo se borra un material que
 * nunca salió de Pendiente, y un Pendiente no puede tener factura (lo frena
 * `createMaterialInvoice`).
 *
 * El proveedor es `provider` (del directorio) o `supplier` (texto libre),
 * nunca los dos: el controller borra uno al setear el otro. `supplier` queda
 * para el que no está cargado en Proveedores y para los datos de antes.
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
  /**
   * Una foto de referencia, para que quien compra y el vendedor sepan de qué
   * pieza se habla. Se agrega, se cambia y se saca en cualquier estado: no es
   * corregir el material, es documentarlo, así que no pasa por
   * `isMaterialEditable`.
   */
  photo?: {
    key: string;
    contentType: string;
    uploadedBy: mongoose.Types.ObjectId;
    uploadedAt: Date;
  } | null;
  provider?: mongoose.Types.ObjectId | null;
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
    photo: {
      type: new Schema(
        {
          key: { type: String, required: true },
          contentType: { type: String, required: true },
          uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          uploadedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: undefined,
    },
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', default: null, index: true },
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
