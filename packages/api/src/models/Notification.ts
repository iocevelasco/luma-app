import mongoose, { Schema, Document } from 'mongoose';
import type { NotificationType, NotificationChannel } from '@luma/shared';

/** Comunicación enviada a un usuario por un canal (§6). */
export interface NotificationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  channels: NotificationChannel[];
  read_at?: Date | null;
  sent_at?: Date | null;
  batch_id?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    channels: { type: [String], default: ['in_app'] },
    read_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    batch_id: { type: String, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user_id: 1, read_at: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<NotificationDocument>(
  'Notification',
  notificationSchema,
);
