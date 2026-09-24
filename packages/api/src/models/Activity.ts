import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { ActivityStatus } from '@luma/shared';

/**
 * Actividad de la planificación semanal de una obra (RF-01). Borrado DURO
 * (excepción deliberada a la baja lógica general del proyecto: no hay
 * auditoría ni dinero real asociado). "Atrasada" es derivado en el frontend,
 * no se persiste acá.
 */
export interface IActivityResponsible {
  name: string;
  user?: mongoose.Types.ObjectId;
}

/** `key` es interno (S3) — nunca sale en la respuesta de la API, ver activity.controller.ts. */
export interface IActivityEvidence {
  /** Opcional en el tipo porque Mongoose lo genera solo al hacer `push`. */
  _id?: mongoose.Types.ObjectId;
  key: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

export interface IActivity extends Document {
  project: mongoose.Types.ObjectId;
  name: string;
  area: string;
  startDate: string;
  endDate: string;
  responsible: IActivityResponsible;
  status: ActivityStatus;
  notes?: string;
  evidence: mongoose.Types.DocumentArray<IActivityEvidence>;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const activityResponsibleSchema = new Schema<IActivityResponsible>(
  {
    name: { type: String, required: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false, default: null },
  },
  { _id: false },
);

const activityEvidenceSchema = new Schema<IActivityEvidence>({
  key: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, required: true, default: Date.now },
});

const activitySchema = new Schema<IActivity>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    responsible: { type: activityResponsibleSchema, required: true },
    status: {
      type: String,
      enum: ['pendiente', 'en_curso', 'completada', 'cancelada'],
      default: 'pendiente',
    },
    notes: { type: String, trim: true },
    evidence: { type: [activityEvidenceSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

activitySchema.index({ project: 1, startDate: 1 });

export const Activity: Model<IActivity> =
  (mongoose.models.Activity as Model<IActivity>) ??
  mongoose.model<IActivity>('Activity', activitySchema);

export default Activity;
