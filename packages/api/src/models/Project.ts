import mongoose, { Schema, Document } from 'mongoose';
import {
  DEFAULT_BUDGET_THRESHOLDS,
  DEFAULT_NOTIFICATION_WINDOW,
  type ProjectStatus,
} from '@luma/shared';

/** El contenedor principal (§6). Todo lo demás se filtra por `project_id`. */
export interface ProjectDocument extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  address?: string;
  status: ProjectStatus;
  currency: string;
  start_date?: Date;
  planned_end_date?: Date;
  owner_id: mongoose.Types.ObjectId;
  budget_id?: mongoose.Types.ObjectId | null;
  budget_thresholds: { warning_pct: number; danger_pct: number };
  notification_window: { start: string; end: string };
  margin_pct: number;
  archived: boolean;
  /** Correlativo de imprevistos. Se incrementa atómicamente al crear uno. */
  contingency_seq: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    address: { type: String, trim: true },
    status: {
      type: String,
      enum: ['planning', 'active', 'paused', 'finished'],
      default: 'planning',
      index: true,
    },
    currency: { type: String, default: 'ARS' },
    start_date: { type: Date },
    planned_end_date: { type: Date },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    budget_id: { type: Schema.Types.ObjectId, ref: 'Budget', default: null },
    budget_thresholds: {
      warning_pct: { type: Number, default: DEFAULT_BUDGET_THRESHOLDS.warning_pct },
      danger_pct: { type: Number, default: DEFAULT_BUDGET_THRESHOLDS.danger_pct },
    },
    notification_window: {
      start: { type: String, default: DEFAULT_NOTIFICATION_WINDOW.start },
      end: { type: String, default: DEFAULT_NOTIFICATION_WINDOW.end },
    },
    margin_pct: { type: Number, default: 10, min: 0, max: 90 },
    archived: { type: Boolean, default: false, index: true },
    contingency_seq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ProjectModel = mongoose.model<ProjectDocument>('Project', projectSchema);
