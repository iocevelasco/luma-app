import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * @deprecated Reemplazada por `ProjectMembership` con `role: 'cliente'`.
 *
 * Se conserva **sólo** para que `scripts/migrate-project-memberships.ts` pueda
 * leerla y para poder volver atrás si la migración sale mal. Ningún controller
 * la usa. Una vez que la migración corrió en producción y pasó un ciclo, se
 * borran el modelo y la colección.
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
