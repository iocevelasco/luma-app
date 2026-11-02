import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { dismissFeedback, getFeedbackStatus, submitFeedback } from '../controllers/index.js';

/**
 * Montado en `/api/feedback`. Es de la persona, no de una obra: el aislamiento
 * lo da el `user` del token. Los resultados agregados los ve sólo el admin, en
 * `/api/admin/feedback`.
 */
export const feedbackRouter = Router();

feedbackRouter.use(isAuthenticated);

feedbackRouter.get('/status', getFeedbackStatus);
feedbackRouter.post('/', submitFeedback);
feedbackRouter.post('/dismiss', dismissFeedback);

export default feedbackRouter;
