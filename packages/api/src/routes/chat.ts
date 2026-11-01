import { Router } from 'express';
import { createChatSession } from '../controllers/chat.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

/** Montado en `/api/chat`. La sesión es de la persona del token, no de una obra. */
export const chatRouter = Router();

chatRouter.post('/session', isAuthenticated, createChatSession);

export default chatRouter;
