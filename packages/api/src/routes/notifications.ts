import { Router } from 'express';
import { isAuthenticated, withProject } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as notificationService from '../services/notification.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(isAuthenticated, withProject);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const list = await notificationService.listFor(req.user!.sub, req.projectId!);
    res.json({
      success: true,
      data: list.map((n) => ({ ...n, id: n._id.toString() })),
    });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await notificationService.markRead(req.user!.sub, req.params.id);
    res.json({ success: true, data: { message: 'Marcada como leída' } });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await notificationService.markAllRead(req.user!.sub, req.projectId!);
    res.json({ success: true, data: { message: 'Todas marcadas como leídas' } });
  }),
);
