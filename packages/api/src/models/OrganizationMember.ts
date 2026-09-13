import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { OrganizationRole } from '@luma/shared';

/**
 * En v1 sólo se crea con `role: 'owner'` — no hay todavía forma de invitar a
 * alguien más al roster de una Empresa.
 */
export interface IOrganizationMember extends Document {
  organization: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: OrganizationRole;
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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

export const OrganizationMember: Model<IOrganizationMember> =
  (mongoose.models.OrganizationMember as Model<IOrganizationMember>) ??
  mongoose.model<IOrganizationMember>('OrganizationMember', organizationMemberSchema);

export default OrganizationMember;
