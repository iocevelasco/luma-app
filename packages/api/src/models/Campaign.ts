import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { CampaignStatus } from '@luma/shared';

/**
 * Un comunicado por correo que manda el admin de la plataforma.
 *
 * Es el registro de lo que se mandó, no una cola: guarda cuántas cuentas lo
 * recibían y cuántos correos salieron. Los destinatarios no se guardan — se
 * resuelven al enviar, y el pasaje de `draft` a `sending` es atómico para que
 * un doble clic no mande dos veces.
 */
export interface ICampaign extends Document {
  title: string;
  body: string;
  /** Id del archivo en el media-service. Lo sirve `GET /api/public/campaigns/:id/image`. */
  imageKey?: string;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  failed: number;
  createdBy: mongoose.Types.ObjectId;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    imageKey: { type: String },
    status: { type: String, enum: ['draft', 'sending', 'sent'], default: 'draft', required: true },
    recipients: { type: Number, default: 0, min: 0 },
    sent: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

campaignSchema.index({ createdAt: -1 });

export const Campaign: Model<ICampaign> =
  (mongoose.models.Campaign as Model<ICampaign> | undefined) ??
  mongoose.model<ICampaign>('Campaign', campaignSchema);
