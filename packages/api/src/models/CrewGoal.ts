import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { LEGACY_CREW_GOAL_STATUS } from '@luma/shared';

/**
 * Meta semanal de una persona o equipo (RF nuevo, pedido del cliente: "poder
 * establecer una semana o dos antes las metas de cada equipo o persona").
 *
 * `weekStart` es siempre el lunes en `YYYY-MM-DD`: la semana ya es la unidad
 * de planificación del producto (RF-01), y guardar un rango sería un segundo
 * calendario que hay que mantener sincronizado con el primero.
 *
 * Sin índice único (crewMember, weekStart): una persona puede tener varias
 * metas en la misma semana.
 *
 * Borrado DURO, mismo criterio que `Activity`: una meta mal cargada se borra
 * y ya, no hay auditoría ni dinero atado.
 */
export interface ICrewGoal extends Document {
  project: mongoose.Types.ObjectId;
  crewMember: mongoose.Types.ObjectId;
  weekStart: string;
  description: string;
  activity?: mongoose.Types.ObjectId | null;
  /**
   * Un `CrewGoalStatus`, o un valor viejo en castellano hasta que corra
   * `migrate:crew`. Por eso es `string`: leer siempre con
   * `normalizeCrewGoalStatus`.
   */
  status: string;
  completedAt?: Date | null;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const crewGoalSchema = new Schema<ICrewGoal>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    crewMember: { type: Schema.Types.ObjectId, ref: 'CrewMember', required: true, index: true },
    weekStart: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true },
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    status: {
      type: String,
      // Los valores viejos siguen en el enum sólo hasta que corra
      // `migrate:crew`: un `save()` valida todos los paths, y un documento sin
      // migrar fallaría al tocarle cualquier otro campo.
      enum: ['pending', 'done', 'discarded', ...Object.keys(LEGACY_CREW_GOAL_STATUS)],
      default: 'pending',
    },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

crewGoalSchema.index({ project: 1, weekStart: 1 });
// El arrastre: "lo abierto de semanas anteriores" de una obra.
crewGoalSchema.index({ project: 1, status: 1, weekStart: 1 });

export const CrewGoal: Model<ICrewGoal> =
  (mongoose.models.CrewGoal as Model<ICrewGoal>) ??
  mongoose.model<ICrewGoal>('CrewGoal', crewGoalSchema);

export default CrewGoal;
