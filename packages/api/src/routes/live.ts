import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isProduction } from '../config/app.config.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import { streamProjectLive } from '../controllers/live.controller.js';

/**
 * Anidado bajo `/api/projects/:projectId/live` — ver routes/project.ts.
 *
 * `project.read`: lo tienen todos los roles; qué recibe cada uno lo filtra el
 * hub por la capacidad de lectura de cada recurso.
 *
 * El rate limit protege el *abrir* (cada apertura cuesta consultas a la base),
 * no el stream. Es holgado a propósito: un iPhone que despierta reconecta, y
 * varias personas detrás de la misma IP (una oficina, un operador móvil)
 * comparten el cupo. Sólo en producción, mismo criterio que el resto.
 */
const openLimiter =
  isProduction
    ? rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        message: 'Demasiadas conexiones en vivo. Prueba de nuevo en un minuto.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

export const liveRouter = Router({ mergeParams: true });

liveRouter.use(openLimiter, isAuthenticated, requireProjectAccess, requireCapability('project.read'));

liveRouter.get('/', streamProjectLive);

export default liveRouter;
