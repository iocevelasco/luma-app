import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '@luma/shared';

/**
 * Aviso dentro de la app, **una fila por persona**.
 *
 * No es un evento compartido con una lista de "quién lo leyó": marcar leído
 * sería entonces editar un documento que varios escriben a la vez, y el
 * contador de no leídos habría que recalcularlo recorriendo esa lista en cada
 * request. Con una fila por persona, "no leídas" es un `countDocuments` sobre
 * un índice.
 *
 * El texto no se guarda armado. Se guarda el dato crudo (`subjectName`) y la
 * UI lo traduce: una notificación escrita en español no se puede releer en
 * portugués, y la persona puede cambiar de idioma después de recibirla.
 */
export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  type: NotificationType;
  /** El nombre de lo que pasó: la actividad, el hito. La UI arma la frase. */
  subjectName: string;
  /** Ruta relativa de la SPA a la que lleva el aviso. */
  link: string;
  readAt?: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    type: { type: String, enum: [...NOTIFICATION_TYPES], required: true },
    subjectName: { type: String, required: true, trim: true },
    link: { type: String, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// La bandeja: las de esta persona, más nuevas primero.
notificationSchema.index({ user: 1, createdAt: -1 });
// El contador del badge: cuántas sin leer tiene. `readAt: null` es el filtro,
// así que va en el índice o el contador escanea toda la bandeja.
notificationSchema.index({ user: 1, readAt: 1 });

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) ??
  mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
