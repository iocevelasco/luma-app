import mongoose, { Schema, Document } from 'mongoose';

/**
 * Regla de negocio 7: toda acción que afecte presupuesto o cronograma queda
 * auditada con usuario, fecha y hora.
 *
 * Colección aparte y sólo-append. Si el rastro viviera embebido en cada
 * entidad, borrar la entidad borraría la evidencia.
 */
export interface AuditLogDocument extends Document {
  _id: mongoose.Types.ObjectId;
  project_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entity_id: { type: String, required: true },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ project_id: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
