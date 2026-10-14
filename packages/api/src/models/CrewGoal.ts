import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * LEGADO. Las "metas semanales" eran una entidad aparte de las actividades:
 * lo que se cargaba en el Tablero no aparecía en el Cronograma, y al revés.
 * Ahora una tarea ES una actividad, y `migrate-crew.ts` convierte cada meta
 * en una tarea.
 *
 * El modelo queda sólo para las migraciones (`migrate-crew`,
 * `migrate-directory-assignments`): ninguna ruta de la API lo usa. Se borra
 * cuando la colección esté migrada en todos los entornos.
 *
 * `status` acepta los valores de las dos épocas — en castellano y en inglés —
 * porque una base puede tener cualquiera de los dos.
 */
export interface ICrewGoal extends Document {
  project: mongoose.Types.ObjectId;
  crewMember: mongoose.Types.ObjectId;
  weekStart: string;
  description: string;
  activity?: mongoose.Types.ObjectId | null;
  status: string;
  completedAt?: Date | null;
  /** La tarea en la que se convirtió. Lo pone `migrate-crew`. */
  migratedToActivity?: mongoose.Types.ObjectId | null;
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
      enum: [
        'pendiente',
        'cumplida',
        'no_cumplida',
        'pending',
        'in_progress',
        'done',
        'discarded',
      ],
      default: 'pending',
    },
    completedAt: { type: Date, default: null },
    migratedToActivity: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

crewGoalSchema.index({ project: 1, weekStart: 1 });

export const CrewGoal: Model<ICrewGoal> =
  (mongoose.models.CrewGoal as Model<ICrewGoal>) ??
  mongoose.model<ICrewGoal>('CrewGoal', crewGoalSchema);

export default CrewGoal;
