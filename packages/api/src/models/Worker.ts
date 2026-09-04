import mongoose, { Schema, Document } from 'mongoose';

/**
 * Trabajador de la obra (RF-03).
 *
 * No es un `User`: la mayoría del personal no entra a la plataforma, y pedir
 * una cuenta por albañil sería fricción pura. Si algún día uno necesita
 * acceso, se le crea un User y se lo invita como `assistant`.
 */
export interface WorkerDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  name: string;
  trade?: string;
  phone?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workerSchema = new Schema<WorkerDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true, trim: true },
    trade: { type: String, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const WorkerModel = mongoose.model<WorkerDocument>('Worker', workerSchema);
