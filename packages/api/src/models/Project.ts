import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { BudgetType, ProjectStatus } from '@luma/shared';

/**
 * Obra o remodelación. `organization` se resuelve server-side desde el
 * `OrganizationMember` de quien la crea — nunca viaja en el body de la request.
 *
 * `estimatedStartDate`/`estimatedEndDate` son strings `YYYY-MM-DD`, no `Date`:
 * ver CLAUDE.md sobre cómo Safari parsea fechas y cómo un `Date` guardado se
 * corre un día según el timezone de quien lo lee.
 */
export interface IProject extends Document {
  organization: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  description: string;
  location: string;
  size?: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  currency: string;
  budgetType: BudgetType;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    size: { type: String, trim: true },
    estimatedStartDate: { type: String, required: true },
    estimatedEndDate: { type: String, required: true },
    currency: { type: String, required: true, trim: true },
    budgetType: { type: String, enum: ['cerrado', 'abierto', 'con_margen'], required: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
);

export const Project: Model<IProject> =
  (mongoose.models.Project as Model<IProject>) ?? mongoose.model<IProject>('Project', projectSchema);

export default Project;
