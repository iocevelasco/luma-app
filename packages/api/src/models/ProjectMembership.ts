import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { INVITABLE_PROJECT_ROLES, type InvitableProjectRole } from '@luma/shared';

/**
 * Acceso de una persona a una obra puntual, con el rol que tiene ahí.
 *
 * Reemplaza a `ProjectClient`, que nombraba la relación por lo que era cuando
 * el cliente era la única persona invitable. Con el supervisor adentro esa
 * decisión dejó de servir: dos tablas de la misma forma terminan con dos
 * flujos de invitación que se desincronizan.
 *
 * **El gerente no tiene fila acá.** Se deriva de `Project.createdBy`: una obra
 * sin dueño no existe, así que una fila que lo repita sólo agrega la
 * posibilidad de que discrepe con el proyecto.
 *
 * El supervisor es por obra y no por Empresa —a diferencia del Asistente de
 * Obra de la v1, que era un `OrganizationMember` y entraba a todas las obras
 * de la Empresa. Un supervisor contratado para un piso no tiene por qué ver
 * el presupuesto de las otras obras.
 */
export interface IProjectMembership extends Document {
  project: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: InvitableProjectRole;
  invitedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const projectMembershipSchema = new Schema<IProjectMembership>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: [...INVITABLE_PROJECT_ROLES], required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Una persona tiene UN rol por obra. Si alguna vez hace falta que el cliente
// sea además supervisor de su propia obra, que sea una decisión de producto y
// no el resultado de dos invitaciones sueltas.
projectMembershipSchema.index({ project: 1, user: 1 }, { unique: true });

export const ProjectMembership: Model<IProjectMembership> =
  (mongoose.models.ProjectMembership as Model<IProjectMembership>) ??
  mongoose.model<IProjectMembership>('ProjectMembership', projectMembershipSchema);

export default ProjectMembership;
