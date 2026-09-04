import mongoose, { Schema, Document } from 'mongoose';
import type { ProjectRole, ProjectMemberStatus } from '@luma/shared';

/**
 * La relación persona ↔ proyecto, con su rol.
 *
 * Es la tabla que hace multi-tenant al producto y la que permite la regla 6
 * del documento: un mismo proyecto puede tener MÁS DE UN usuario en rol
 * cliente (el que paga y su asesor de confianza), con idénticos permisos.
 */
export interface ProjectMemberDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  role: ProjectRole;
  status: ProjectMemberStatus;
  invited_by?: mongoose.Types.ObjectId;
  invited_at?: Date;
  joined_at?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectMemberSchema = new Schema<ProjectMemberDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['executor', 'manager', 'assistant', 'client'],
      required: true,
    },
    status: {
      type: String,
      enum: ['invited', 'active', 'removed'],
      default: 'invited',
      index: true,
    },
    invited_by: { type: Schema.Types.ObjectId, ref: 'User' },
    invited_at: { type: Date, default: Date.now },
    joined_at: { type: Date },
  },
  { timestamps: true },
);

// Una sola membresía por persona y proyecto: cambiar de rol es un update, no
// una fila nueva, para que no queden dos roles vigentes contradiciéndose.
projectMemberSchema.index({ project_id: 1, user_id: 1 }, { unique: true });
projectMemberSchema.index({ user_id: 1, status: 1 });

export const ProjectMemberModel = mongoose.model<ProjectMemberDocument>(
  'ProjectMember',
  projectMemberSchema,
);
