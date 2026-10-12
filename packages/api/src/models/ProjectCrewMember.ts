import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Un empleado de la Empresa puesto a disposición de UNA obra. Mismo patrón que
 * `ProjectProvider`.
 *
 * Antes, la obra de un empleado se deducía de sus actividades (`ActivityCrew`),
 * así que alguien que todavía no tenía actividad no "estaba" en la obra y no se
 * lo podía asignar desde ella. Esta fila lo dice de forma directa.
 *
 * Sin tarifa propia por obra a propósito: si un mismo empleado puede cobrar
 * distinto según la obra es una decisión de producto todavía abierta, y el
 * campo quedaría en el modelo para siempre.
 */
export interface IProjectCrewMember extends Document {
  project: mongoose.Types.ObjectId;
  crewMember: mongoose.Types.ObjectId;
  createdAt: Date;
}

const projectCrewMemberSchema = new Schema<IProjectCrewMember>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    crewMember: { type: Schema.Types.ObjectId, ref: 'CrewMember', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

projectCrewMemberSchema.index({ project: 1, crewMember: 1 }, { unique: true });

export const ProjectCrewMember: Model<IProjectCrewMember> =
  (mongoose.models.ProjectCrewMember as Model<IProjectCrewMember>) ??
  mongoose.model<IProjectCrewMember>('ProjectCrewMember', projectCrewMemberSchema);

export default ProjectCrewMember;
