import type { Request, Response } from 'express';
import type { AppNotification } from '@luma/shared';
import { Notification } from '../models/Notification.js';
import { unreadCountFor } from '../services/notification.service.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/** Tope de la bandeja. Sin paginación en v1: nadie baja de 50 avisos buscando algo. */
const INBOX_LIMIT = 50;

/**
 * La bandeja de quien pide. **No lleva `requireProjectAccess`**: no cuelga de
 * una obra, cruza todas las de la persona. El aislamiento lo da el filtro por
 * `user`, que sale del token y nunca del body.
 */
export async function listNotifications(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const docs = await Notification.find({ user: req.user.sub })
      .sort({ createdAt: -1 })
      .limit(INBOX_LIMIT)
      .populate<{ project: { _id: unknown; name: string } }>('project', 'name');

    const notifications: AppNotification[] = docs
      // Una obra borrada deja avisos colgados; `populate` los trae con
      // `project: null` y sin este filtro la bandeja entera reventaría al leer
      // `.name` de null.
      .filter((doc) => doc.project)
      .map((doc) => ({
        id: String(doc._id),
        projectId: String(doc.project._id),
        projectName: doc.project.name,
        type: doc.type,
        subjectName: doc.subjectName,
        link: doc.link,
        readAt: doc.readAt ? doc.readAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
      }));

    return res.json({
      success: true,
      data: { notifications, unreadCount: await unreadCountFor(req.user.sub) },
    });
  } catch (error) {
    console.error('❌ [NOTIFICATION] listNotifications:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Marca leída una, o todas si no viene `:notificationId`.
 *
 * El filtro incluye `user` además del id: sin eso, alguien con el id de la
 * notificación de otra persona podría marcársela como leída.
 */
export async function markNotificationsRead(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const filter: Record<string, unknown> = { user: req.user.sub, readAt: null };
    if (req.params.notificationId) {
      filter._id = req.params.notificationId;
    }

    await Notification.updateMany(filter, { readAt: new Date() });

    return res.json({ success: true, data: { unreadCount: await unreadCountFor(req.user.sub) } });
  } catch (error) {
    console.error('❌ [NOTIFICATION] markNotificationsRead:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
