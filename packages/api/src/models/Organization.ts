import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Empresa del ejecutante. No está en el documento funcional del producto — es
 * una extensión deliberada para no tener que re-parentar obras más adelante.
 * Se auto-crea con cada usuario nuevo (ver `services/organization.service.ts`),
 * nunca la crea nadie a mano.
 */
export interface IOrganization extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const Organization: Model<IOrganization> =
  (mongoose.models.Organization as Model<IOrganization>) ??
  mongoose.model<IOrganization>('Organization', organizationSchema);

export default Organization;
