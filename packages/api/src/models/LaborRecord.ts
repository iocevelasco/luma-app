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
    expectedCount: { type: Number, required: true, min: 0 },
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
