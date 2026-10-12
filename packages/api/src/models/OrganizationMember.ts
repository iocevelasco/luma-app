import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { COMPANY_STAFF_ROLES, type CompanyStaffRole, type OrganizationRole } from '@luma/shared';

/**
 * Quién pertenece a una Empresa. `role` es el vínculo (dueño o integrante);
 * `staffRole` es la función que cumple el integrante —gerente, supervisor,
 * contador— y es sólo una etiqueta: **no concede acceso a ninguna obra**.
 * Opcional porque el dueño no la necesita y los integrantes anteriores a este
 * campo no la tienen.
 */
export interface IOrganizationMember extends Document {
  organization: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: OrganizationRole;
  staffRole?: CompanyStaffRole;
  /** Contacto que la Empresa tiene de la persona; no toca su perfil de usuario. */
  phone?: string;
  createdAt: Date;
}

const organizationMemberSchema = new Schema<IOrganizationMember>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'member'], default: 'owner', required: true },
    staffRole: { type: String, enum: [...COMPANY_STAFF_ROLES] },
    phone: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

export const OrganizationMember: Model<IOrganizationMember> =
  (mongoose.models.OrganizationMember as Model<IOrganizationMember>) ??
  mongoose.model<IOrganizationMember>('OrganizationMember', organizationMemberSchema);

export default OrganizationMember;
