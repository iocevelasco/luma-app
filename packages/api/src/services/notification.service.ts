import crypto from 'crypto';
import mongoose from 'mongoose';
import type { NotificationType, ProjectRole } from '@luma/shared';
import { NotificationModel } from '../models/Notification.js';
import { ProjectMemberModel } from '../models/ProjectMember.js';
import { UserModel } from '../models/User.js';
import { ProjectModel } from '../models/Project.js';
import { FEATURE_FLAGS } from '../config/app.config.js';

/**
 * Notificaciones (RF-08, RF-09).
 *
 * Las reglas de RF-09 viven acá, no en cada llamador:
 *  - AGRUPACIÓN: lo no urgente se junta con un `batch_id` en vez de gotear
 *    malas noticias de a una.
 *  - MOMENTO: nada sale fuera de la ventana horaria del proyecto; se marca
 *    como pendiente y el scheduler la despacha cuando abre la ventana.
 *  - Lo urgente (algo que detiene la obra) ignora la ventana: esperar a las
 *    ocho de la mañana para avisar que la obra está parada es peor que
 *    molestar.
 */

function withinWindow(window: { start: string; end: string }, now = new Date()): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = window.start.split(':').map(Number);
  const [eh, em] = window.end.split(':').map(Number);
  return minutes >= sh * 60 + sm && minutes <= eh * 60 + em;
}

export async function recipientsByRole(
  projectId: string,
  roles: ProjectRole[],
): Promise<Array<{ userId: string; email: string; name?: string }>> {
  const memberships = await ProjectMemberModel.find({
    project_id: new mongoose.Types.ObjectId(projectId),
    role: { $in: roles },
    status: 'active',
  }).lean();

  if (memberships.length === 0) return [];

  const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.user_id) } })
    .select({ email: 1, name: 1 })
    .lean();

  return users.map((u) => ({ userId: u._id.toString(), email: u.email, name: u.name }));
}

export async function notify(params: {
  projectId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  urgent?: boolean;
  /** Junta esta notificación con otras del mismo lote (RF-09, agrupación). */
  batchKey?: string;
}): Promise<void> {
  if (params.userIds.length === 0) return;

  const project = await ProjectModel.findById(params.projectId).lean();
  const inWindow = project ? withinWindow(project.notification_window) : true;
  const sendNow = params.urgent === true || inWindow;

  const batchId =
    FEATURE_FLAGS.BATCH_NON_URGENT_NOTIFICATIONS && !params.urgent && params.batchKey
      ? crypto.createHash('sha1').update(params.batchKey).digest('hex').slice(0, 12)
      : null;

  await NotificationModel.insertMany(
    params.userIds.map((userId) => ({
      project_id: new mongoose.Types.ObjectId(params.projectId),
      user_id: new mongoose.Types.ObjectId(userId),
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      channels: ['in_app'],
      // `sent_at` en null = todavía no salió por email. El scheduler lo levanta
      // cuando abre la ventana horaria.
      sent_at: sendNow ? new Date() : null,
      batch_id: batchId,
    })),
  );
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await NotificationModel.updateOne(
    { _id: notificationId, user_id: new mongoose.Types.ObjectId(userId) },
    { read_at: new Date() },
  );
}

export async function markAllRead(userId: string, projectId: string): Promise<void> {
  await NotificationModel.updateMany(
    {
      user_id: new mongoose.Types.ObjectId(userId),
      project_id: new mongoose.Types.ObjectId(projectId),
      read_at: null,
    },
    { read_at: new Date() },
  );
}

export async function listFor(userId: string, projectId: string, limit = 50) {
  return NotificationModel.find({
    user_id: new mongoose.Types.ObjectId(userId),
    project_id: new mongoose.Types.ObjectId(projectId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}
