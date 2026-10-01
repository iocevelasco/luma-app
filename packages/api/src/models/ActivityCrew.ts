import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Quiénes se esperan en una actividad. Es una asignación PERSISTENTE: se
 * define una vez y cada día aparece esa misma lista para confirmar, igual que
 * en Procore o BuildOps —el plan se arma antes del turno, en el día sólo se
 * tilda—.
 *
 * Reemplaza al viejo `LaborRecord.expectedCount`, que era un número suelto: si
 * el sistema sólo sabe "se esperaban 8", puede decir que falta uno pero nunca
 * cuál, y por lo tanto tampoco a quién llamar.
 *
 * Mismo patrón que `ActivityProvider`: tabla puente con índice único
 * compuesto, no un array embebido.
 */
export interface IActivityCrew extends Document {
  activity: mongoose.Types.ObjectId;
  crewMember: mongoose.Types.ObjectId;
  createdAt: Date;
}

const activityCrewSchema = new Schema<IActivityCrew>(
  {
    activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
    crewMember: { type: Schema.Types.ObjectId, ref: 'CrewMember', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activityCrewSchema.index({ activity: 1, crewMember: 1 }, { unique: true });

export const ActivityCrew: Model<IActivityCrew> =
  (mongoose.models.ActivityCrew as Model<IActivityCrew>) ??
  mongoose.model<IActivityCrew>('ActivityCrew', activityCrewSchema);

export default ActivityCrew;
