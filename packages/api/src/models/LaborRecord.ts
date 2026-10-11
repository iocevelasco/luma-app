import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Registro diario de mano de obra por actividad (RF-03). Índice único
 * (activity, date): recargar el mismo día actualiza el registro existente en
 * vez de duplicarlo — es un parte diario, no un historial de altas.
 */
export interface ILaborRecord extends Document {
  project: mongoose.Types.ObjectId;
  activity: mongoose.Types.ObjectId;
  date: string;
  /**
   * Quiénes estuvieron hoy. Lo esperado NO se guarda acá: sale de
   * `ActivityCrew`, que es la asignación vigente. Con los dos conjuntos se
   * derivan las dos preguntas del día sin guardar nada más:
   * ausentes = esperados − presentes, y reemplazos = presentes − esperados.
   */
  presentCrewMembers: mongoose.Types.ObjectId[];
  /**
   * Partes viejos, de cuando la asistencia era un número y nombres tipeados a
   * mano. Se conservan en sólo lectura: no hay forma honesta de adivinar a qué
   * persona del roster correspondía cada texto, y borrarlos perdería el
   * historial de quién estuvo en la obra.
   */
  expectedCount: number;
  presentNames: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const laborRecordSchema = new Schema<ILaborRecord>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
    date: { type: String, required: true },
    presentCrewMembers: {
      type: [{ type: Schema.Types.ObjectId, ref: 'CrewMember' }],
      default: [],
    },
    // Legado: ya no se escriben, sólo se leen en los partes viejos.
    expectedCount: { type: Number, default: 0, min: 0 },
    presentNames: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

laborRecordSchema.index({ activity: 1, date: 1 }, { unique: true });

export const LaborRecord: Model<ILaborRecord> =
  (mongoose.models.LaborRecord as Model<ILaborRecord>) ??
  mongoose.model<ILaborRecord>('LaborRecord', laborRecordSchema);

export default LaborRecord;
