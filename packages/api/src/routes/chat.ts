import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createChatSession } from '../controllers/chat.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { AppError } from '../utils/errors.js';

/**
 * Abrir una sesión es barato, pero cada conversación nueva es una sesión más en
 * NexusBot. Rate limit sólo en producción, mismo criterio que el Consultor IA.
 * El límite por mensaje del chat lo pone NexusBot, que es quien paga el modelo.
 */
const sessionLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req: Request, _res: Response, next: NextFunction) =>
          next(new AppError('RATE_LIMITED', 'Abriste demasiadas conversaciones. Espera unos minutos.')),
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

/** Montado en `/api/chat`. La sesión es de la persona del token, no de una obra. */
export const chatRouter = Router();

chatRouter.post('/session', isAuthenticated, sessionLimiter, createChatSession);

export default chatRouter;
