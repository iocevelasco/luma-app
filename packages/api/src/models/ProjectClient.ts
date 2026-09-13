import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Acceso de un cliente (quien paga la obra) a una obra puntual. Sin campo de
 * rol: en v1 es la única relación invitable, así que la entidad se nombra por
 * lo que es en vez de un `roles: []` genérico que nadie pidió todavía.
 */
export interface IProjectClient extends Document {
  project: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const projectClientSchema = new Schema<IProjectClient>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

projectClientSchema.index({ project: 1, user: 1 }, { unique: true });

export const ProjectClient: Model<IProjectClient> =
  (mongoose.models.ProjectClient as Model<IProjectClient>) ??
  mongoose.model<IProjectClient>('ProjectClient', projectClientSchema);

export default ProjectClient;
