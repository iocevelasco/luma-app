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
 * no el stream, y cuenta **por persona** y no por IP: una oficina o un operador
 * móvil comparten IP, y un corte masivo (un deploy, un cambio de acceso) hace
 * reconectar a todos a la vez; con la IP como llave, los últimos quedarían con
 * 429 y varios minutos sin canal. Por eso va después de `isAuthenticated`, que
 * es barato (sólo verifica la firma). Sólo en producción, mismo criterio que el
 * resto.
 */

/** La llave del límite: la persona; sin sesión (no debería llegar acá), la IP. */
export function openLimiterKey(req: Pick<Request, 'user' | 'ip'>): string {
  return req.user?.sub ?? req.ip ?? 'anonymous';
}

const openLimiter =
  isProduction
    ? rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        keyGenerator: openLimiterKey,
        message: 'Demasiadas conexiones en vivo. Prueba de nuevo en un minuto.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

export const liveRouter = Router({ mergeParams: true });

liveRouter.use(isAuthenticated, openLimiter, requireProjectAccess, requireCapability('project.read'));

liveRouter.get('/', streamProjectLive);

export default liveRouter;
