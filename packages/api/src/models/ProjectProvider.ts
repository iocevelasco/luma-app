import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Un proveedor de la libreta de la Empresa puesto a disposición de UNA obra.
 *
 * La libreta es de la Empresa y se comparte; esta fila es lo que decide qué
 * parte de ella ve cada obra. Sin fila, la obra no ve al proveedor ni puede
 * asignarlo a una actividad ni contratarlo. Es el vínculo y nada más: la
 * contratación (monto, adelanto) sigue siendo `ProviderEngagement`, y quién
 * trabaja en qué actividad sigue siendo `ActivityProvider`.
 *
 * Los proveedores de alcance `project` no pasan por acá: ya pertenecen a una
 * sola obra por su campo `project`.
 */
export interface IProjectProvider extends Document {
  project: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  createdAt: Date;
}

const projectProviderSchema = new Schema<IProjectProvider>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    provider: { type: Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

projectProviderSchema.index({ project: 1, provider: 1 }, { unique: true });

export const ProjectProvider: Model<IProjectProvider> =
  (mongoose.models.ProjectProvider as Model<IProjectProvider>) ??
  mongoose.model<IProjectProvider>('ProjectProvider', projectProviderSchema);

export default ProjectProvider;
