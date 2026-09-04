import mongoose, { Schema, Document } from 'mongoose';
import type { ActivityStatus } from '@luma/shared';

/** Unidad de trabajo planificada (RF-01, RF-04). */
export interface ActivityDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  name: string;
  area?: string;
  chapter_code?: string;
  planned_start: Date;
  planned_end: Date;
  responsible_id?: mongoose.Types.ObjectId | null;
  status: ActivityStatus;
  blocked_reason?: string;
  weight: number;
  planned_headcount: number;
  week: string;
  progress_photos: string[];
  completed_at?: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    chapter_code: { type: String, trim: true, index: true },
    planned_start: { type: Date, required: true },
    planned_end: { type: Date, required: true },
    responsible_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'done', 'blocked'],
      default: 'pending',
      index: true,
    },
    blocked_reason: { type: String, trim: true },
    // Por defecto 1: sin ponderar, el avance es la fracción de actividades
    // listas, que ya sirve. Ponderar es una mejora, no un requisito de carga.
    weight: { type: Number, default: 1, min: 0 },
    planned_headcount: { type: Number, default: 0, min: 0 },
    // Denormalizado: la semana es la unidad de consulta principal del
    // dashboard y calcularla en cada query costaría un $expr por fila.
    week: { type: String, required: true, index: true },
    progress_photos: { type: [String], default: [] },
    completed_at: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

activitySchema.index({ project_id: 1, week: 1 });
activitySchema.index({ project_id: 1, status: 1 });

export const ActivityModel = mongoose.model<ActivityDocument>('Activity', activitySchema);
