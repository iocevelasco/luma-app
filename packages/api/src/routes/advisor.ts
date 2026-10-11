import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import { sendProjectAdvisorMessage } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/advisor` — ver routes/project.ts.
 * `advisor.use` acompaña a `budget.read`: el Consultor IA lee presupuesto
 * entre sus herramientas, así que dejar entrar acá a alguien que no puede ver
 * el presupuesto sería un bypass de la regla 13 por un camino lateral.
 *
 * Rate limit sólo en producción, mismo criterio que `authLimiter`: cada
 * mensaje dispara una llamada real a Claude, y en desarrollo/tests no vale la
 * pena pagar esa cuenta contra un límite artificial.
 */
const advisorLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: 'Demasiadas preguntas al Consultor IA. Probá de nuevo en unos minutos.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

export const advisorRouter = Router({ mergeParams: true });

advisorRouter.use(isAuthenticated, requireProjectAccess, requireCapability('advisor.use'));

advisorRouter.post('/', advisorLimiter, sendProjectAdvisorMessage);

export default advisorRouter;
