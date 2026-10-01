import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ProviderEngagementStatus, ProviderRequirementType } from '@luma/shared';

/**
 * Contratación de un proveedor para una obra (solicitud de cotización →
 * aprobación → adelanto y fecha de inicio). Es el acuerdo comercial; quién
 * trabaja en qué actividad sigue siendo `ActivityProvider`.
 *
 * Sin índice único (project, provider) a propósito: al mismo carpintero se lo
 * contrata para las aberturas en marzo y para los muebles en agosto, y son
 * dos acuerdos distintos con su propia cotización.
 *
 * Los montos son COMPROMISO contra el presupuesto, no contabilidad: acá no
 * hay cuentas por pagar ni flujo de caja (ver documento funcional, regla 8).
 */
export interface IProviderRequirement {
  _id?: mongoose.Types.ObjectId;
  type: ProviderRequirementType;
  detail?: string;
  activity?: mongoose.Types.ObjectId | null;
  met: boolean;
}

export interface IProviderEngagement extends Document {
  project: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  status: ProviderEngagementStatus;
  quotedAmount?: number;
  advanceAmount?: number;
  /** `YYYY-MM-DD` como string, no `Date` — ver CLAUDE.md sobre timezones. */
  estimatedStartDate?: string;
  requirements: mongoose.Types.DocumentArray<IProviderRequirement>;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const requirementSchema = new Schema<IProviderRequirement>({
  type: {
    type: String,
    enum: ['materiales_en_obra', 'personal_libre', 'area_desocupada', 'actividad_previa', 'otro'],
    required: true,
  },
  detail: { type: String, trim: true },
  activity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
  met: { type: Boolean, default: false },
});

const providerEngagementSchema = new Schema<IProviderEngagement>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    status: {
      type: String,
      enum: ['solicitada', 'cotizada', 'aprobada', 'rechazada'],
      default: 'solicitada',
    },
    quotedAmount: { type: Number, min: 0 },
    advanceAmount: { type: Number, min: 0 },
    estimatedStartDate: { type: String },
    requirements: { type: [requirementSchema], default: [] },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

providerEngagementSchema.index({ project: 1, provider: 1 });

export const ProviderEngagement: Model<IProviderEngagement> =
  (mongoose.models.ProviderEngagement as Model<IProviderEngagement>) ??
  mongoose.model<IProviderEngagement>('ProviderEngagement', providerEngagementSchema);

export default ProviderEngagement;
