import mongoose from 'mongoose';
import type { NotificationType, ProjectRole } from '@luma/shared';
import { Notification } from '../models/Notification.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import type { IProject } from '../models/Project.js';

/**
 * Reparto de avisos.
 *
 * Vive en un servicio y no en un controller porque lo necesitan tres lugares
 * —actividades, hitos y, cuando exista, pagos— y con tres copias una se
 * desactualiza. Es el mismo criterio que `commitment.service.ts`.
 *
 * **Avisar nunca puede voltear la acción que lo disparó.** Si el reparto
 * falla, la actividad igual se completó y el hito igual se guardó: se loguea
 * y se sigue. Un 500 al cerrar una actividad porque no se pudo insertar un
 * aviso sería peor que el aviso que falta.
 */

/** Quién recibe, expresado en roles y no en ids: el servicio resuelve las personas. */
export interface NotifyParams {
  project: IProject;
  type: NotificationType;
  subjectName: string;
  link: string;
  /** Roles que reciben el aviso. */
  audience: readonly ProjectRole[];
  /** Quien disparó la acción. No se avisa a sí mismo. */
  actorId: string;
}

/**
 * Las personas de una obra que tienen alguno de esos roles. El gerente sale de
 * `createdBy` —no tiene fila de membresía— y el resto de `ProjectMembership`.
 */
async function recipientsFor(
  project: IProject,
  roles: readonly ProjectRole[],
): Promise<mongoose.Types.ObjectId[]> {
  const ids: mongoose.Types.ObjectId[] = [];

  if (roles.includes('gerente')) {
    ids.push(project.createdBy as mongoose.Types.ObjectId);
  }

  const invitable = roles.filter((role) => role !== 'gerente');
  if (invitable.length > 0) {
    const rows = await ProjectMembership.find({
      project: project._id,
      role: { $in: invitable },
    }).select('user');
    ids.push(...rows.map((row) => row.user));
  }

  return ids;
}

/**
 * Crea un aviso por persona. Devuelve cuántos se crearon — útil en tests y en
 * el log, nunca para decidir si la acción salió bien.
 */
export async function notifyProject(params: NotifyParams): Promise<number> {
  try {
    const recipients = await recipientsFor(params.project, params.audience);

    const docs = recipients
      // Nadie se avisa a sí mismo: quien acaba de cerrar la actividad ya sabe
      // que la cerró, y un badge que se enciende por tu propia acción enseña
      // a ignorar el badge.
      .filter((userId) => String(userId) !== params.actorId)
      .map((userId) => ({
        user: userId,
        project: params.project._id,
        type: params.type,
        subjectName: params.subjectName,
        link: params.link,
      }));

    if (docs.length === 0) return 0;

    await Notification.insertMany(docs);
    return docs.length;
  } catch (error) {
    // A propósito no se relanza: ver el comentario de arriba.
    console.error('❌ [NOTIFICATION] notifyProject:', error);
    return 0;
  }
}

/** Cuántas sin leer tiene esta persona. Es el número del badge. */
export async function unreadCountFor(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, readAt: null });
}
