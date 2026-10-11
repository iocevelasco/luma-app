import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  MILESTONE_AUDIENCES,
  MILESTONE_SEVERITIES,
  MILESTONE_TYPES,
  type MilestoneAudience,
  type MilestoneSeverity,
  type MilestoneType,
} from '@luma/shared';

/**
 * Hito de obra o eventualidad interna. Una sola entidad para los dos flujos de
 * la matriz —el gerente publica hitos al cliente, el supervisor reporta
 * eventualidades al gerente— porque tienen la misma forma y sólo cambia el
 * público. Ver `@luma/shared/types/milestone.ts`.
 *
 * `occurredOn` es un string `YYYY-MM-DD` y no un `Date`: un hito pasa un día,
 * no a una hora, y un `Date` guardado se corre un día según el timezone de
 * quien lo lee. Mismo criterio que `Project.estimatedStartDate`.
 */
export interface IMilestone extends Document {
  project: mongoose.Types.ObjectId;
  type: MilestoneType;
  audience: MilestoneAudience;
  severity: MilestoneSeverity;
  title: string;
  description?: string;
  occurredOn: string;
  activity?: mongoose.Types.ObjectId | null;
  reportedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IMilestone>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    type: { type: String, enum: [...MILESTONE_TYPES], required: true },
    audience: { type: String, enum: [...MILESTONE_AUDIENCES], required: true },
    severity: { type: String, enum: [...MILESTONE_SEVERITIES], default: 'info' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    occurredOn: { type: String, required: true },
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// La pantalla lee la cronología de una obra, y el cliente sólo la parte suya:
// `audience` entra en el índice porque está en el `where` de esa consulta.
milestoneSchema.index({ project: 1, audience: 1, occurredOn: -1 });

export const Milestone: Model<IMilestone> =
  (mongoose.models.Milestone as Model<IMilestone>) ??
  mongoose.model<IMilestone>('Milestone', milestoneSchema);

export default Milestone;
