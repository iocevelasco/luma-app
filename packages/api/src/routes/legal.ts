import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { submitServiceCancellation } from '../controllers/service-cancellation.controller.js';
import { wrapAsync } from '../utils/errors.js';

export const legalRouter = Router();

/**
 * Público y sin sesión. El tope va por IP y sólo en producción: en local y en
 * los tests se manda el formulario varias veces seguidas.
 */
const cancellationLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: {
          success: false,
          error: 'Demasiadas solicitudes de baja. Prueba de nuevo en unos minutos.',
          code: 'RATE_LIMITED',
        },
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

legalRouter.post('/service-cancellation', cancellationLimiter, wrapAsync(submitServiceCancellation));
