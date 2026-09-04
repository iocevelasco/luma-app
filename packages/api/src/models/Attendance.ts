import mongoose, { Schema, Document } from 'mongoose';

/** Personal esperado frente a personal presente, por día (RF-03). */
export interface AttendanceDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  worker_id: mongoose.Types.ObjectId;
  /** YYYY-MM-DD. String y no Date: la obra piensa en días, no en instantes. */
  date: string;
  present: boolean;
  activity_id?: mongoose.Types.ObjectId | null;
  notes?: string;
  recorded_by: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<AttendanceDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    worker_id: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    date: { type: String, required: true, index: true },
    present: { type: Boolean, required: true },
    activity_id: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    notes: { type: String, trim: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Un registro por persona y día. Corregir el parte es un upsert, no una fila
// nueva — si no, "presentes hoy" cuenta dos veces al mismo albañil.
attendanceSchema.index({ project_id: 1, worker_id: 1, date: 1 }, { unique: true });

export const AttendanceModel = mongoose.model<AttendanceDocument>('Attendance', attendanceSchema);
