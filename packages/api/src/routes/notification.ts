import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { listNotifications, markNotificationsRead } from '../controllers/index.js';

/**
 * Montado en `/api/notifications`, **no** bajo una obra: la bandeja de una
 * persona cruza todas sus obras. El aislamiento lo da el filtro por `user` del
 * token, no un `requireProjectAccess`.
 */
export const notificationRouter = Router();

notificationRouter.use(isAuthenticated);

notificationRouter.get('/', listNotifications);
// Sin id marca todas: es el "marcar todo como leído" de la bandeja.
notificationRouter.post('/read', markNotificationsRead);
notificationRouter.post('/:notificationId/read', markNotificationsRead);

export default notificationRouter;
