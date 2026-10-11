import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import { sendProjectAdvisorMessage } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/advisor` — ver routes/project.ts.
 * `requireProjectOwner`, mismo gate que `budgetRouter`: el Consultor IA lee
 * presupuesto entre sus herramientas, y en este corte el presupuesto es
 * owner-only (regla 13) — dejar pasar al Asistente de Obra acá sería un
 * bypass de esa regla por un camino lateral.
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

advisorRouter.use(isAuthenticated, requireProjectAccess, requireProjectOwner);

advisorRouter.post('/', advisorLimiter, sendProjectAdvisorMessage);

export default advisorRouter;
