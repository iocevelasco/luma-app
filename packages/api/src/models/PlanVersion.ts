import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ExtraProjectTier, PlanConfig } from '@luma/shared';

/**
 * Una lista de precios publicada por un admin de la plataforma.
 *
 * Sólo se agregan: cambiar un precio es publicar una versión nueva, y la
 * vigente es la de mayor `version`, sin un flag guardado. Así los pagos
 * congelados siguen apuntando a lo que costaba entonces, y cada alta es la
 * auditoría de quién cambió qué.
 */
export interface IPlanVersion extends Document {
  version: number;
  config: PlanConfig;
  note: string | null;
  createdBy: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const extraTierSchema = new Schema<ExtraProjectTier>(
  {
    upToProjects: { type: Number, default: null },
    unitUsd: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const planConfigSchema = new Schema<PlanConfig>(
  {
    basePriceUsd: { type: Number, required: true, min: 0 },
    includedProjects: { type: Number, required: true, min: 1 },
    trialDays: { type: Number, required: true, min: 1 },
    extraTiers: { type: [extraTierSchema], required: true },
    unlimitedPriceUsd: { type: Number, default: null },
  },
  { _id: false },
);

const planVersionSchema = new Schema<IPlanVersion>(
  {
    version: { type: Number, required: true, unique: true },
    config: { type: planConfigSchema, required: true },
    note: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const PlanVersion: Model<IPlanVersion> =
  (mongoose.models.PlanVersion as Model<IPlanVersion>) ??
  mongoose.model<IPlanVersion>('PlanVersion', planVersionSchema);

export default PlanVersion;
