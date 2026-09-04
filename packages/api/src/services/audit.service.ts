import mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog.js';

/**
 * Registro de auditoría (regla de negocio 7).
 *
 * Nunca tira: una auditoría que falla no puede abortar la operación que ya se
 * hizo. Sí loguea, para que el hueco se note.
 */
export async function audit(params: {
  projectId: string | mongoose.Types.ObjectId;
  userId: string | mongoose.Types.ObjectId;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
}): Promise<void> {
  try {
    await AuditLogModel.create({
      project_id: new mongoose.Types.ObjectId(params.projectId),
      user_id: new mongoose.Types.ObjectId(params.userId),
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      summary: params.summary,
    });
  } catch (error) {
    console.error('⚠️  [AUDIT] No se pudo registrar la acción:', error);
  }
}
