import mongoose, { Schema, Document } from 'mongoose';
import type {
  ContingencyStatus,
  ContingencyUrgency,
  ContingencyOption,
  ContingencyHistoryEntry,
} from '@luma/shared';

/**
 * Imprevisto (RF-07, RF-08). El diferenciador del producto.
 *
 * Dos decisiones que vienen del documento y no son negociables:
 *
 *  1. `why_happened` es requerido a nivel de schema, no sólo de formulario. Es
 *     lo que convierte un cobro en una explicación (regla de negocio 2), y si
 *     una ruta futura crea imprevistos sin pasar por el form, Mongo la frena.
 *  2. `history` sólo crece. Ningún camino de la API reemplaza entradas: el
 *     historial de decisiones es inmutable una vez cerrado (regla 5).
 */
export interface ContingencyDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  code: string;
  what_happened: string;
  why_happened: string;
  impact_cost: number;
  impact_days: number;
  options: ContingencyOption[];
  evidence: string[];
  urgency: ContingencyUrgency;
  blocking_since?: Date | null;
  affected_activity_ids: mongoose.Types.ObjectId[];
  chapter_code?: string;
  status: ContingencyStatus;
  created_by: mongoose.Types.ObjectId;
  internal_approved_by?: mongoose.Types.ObjectId | null;
  internal_approved_at?: Date | null;
  sent_to_client_at?: Date | null;
  client_decision?: {
    by: mongoose.Types.ObjectId;
    by_name?: string;
    at: Date;
    decision: 'approved' | 'rejected' | 'alternative';
    comment?: string;
    chosen_option?: number;
  } | null;
  history: ContingencyHistoryEntry[];
  batch_id?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const optionSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    cost: { type: Number, default: 0, min: 0 },
    days: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    at: { type: String, required: true },
    by: { type: String, required: true },
    by_name: { type: String },
    from_status: { type: String, default: null },
    to_status: { type: String, required: true },
    comment: { type: String, trim: true },
  },
  { _id: false },
);

const contingencySchema = new Schema<ContingencyDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    code: { type: String, required: true },
    what_happened: { type: String, required: true, trim: true },
    why_happened: {
      type: String,
      required: [true, 'La causa del imprevisto es obligatoria'],
      trim: true,
    },
    impact_cost: { type: Number, default: 0, min: 0 },
    impact_days: { type: Number, default: 0, min: 0 },
    options: { type: [optionSchema], default: [] },
    evidence: { type: [String], default: [] },
    urgency: {
      type: String,
      enum: ['blocking', 'non_blocking'],
      default: 'non_blocking',
      index: true,
    },
    blocking_since: { type: Date, default: null },
    affected_activity_ids: { type: [{ type: Schema.Types.ObjectId, ref: 'Activity' }], default: [] },
    chapter_code: { type: String, trim: true },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_internal',
        'internal_approved',
        'sent_to_client',
        'client_approved',
        'client_rejected',
        'alternative_requested',
        'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    internal_approved_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    internal_approved_at: { type: Date, default: null },
    sent_to_client_at: { type: Date, default: null },
    client_decision: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          by_name: { type: String },
          at: { type: Date, required: true },
          decision: { type: String, enum: ['approved', 'rejected', 'alternative'], required: true },
          comment: { type: String, trim: true },
          chosen_option: { type: Number },
        },
        { _id: false },
      ),
      default: null,
    },
    history: { type: [historySchema], default: [] },
    batch_id: { type: String, default: null, index: true },
  },
  { timestamps: true },
);

contingencySchema.index({ project_id: 1, code: 1 }, { unique: true });
contingencySchema.index({ project_id: 1, status: 1 });

export const ContingencyModel = mongoose.model<ContingencyDocument>(
  'Contingency',
  contingencySchema,
);
