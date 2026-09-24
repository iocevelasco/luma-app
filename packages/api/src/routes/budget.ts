import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import { createBudget, getBudget } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/budget` — ver routes/project.ts.
 *
 * A diferencia de materials/labor, acá `requireProjectOwner` va a nivel de
 * `.use()` e incluye el GET: el cliente invitado no ve presupuesto en este
 * corte (regla 13 — la utilidad del ejecutante nunca es visible para el
 * cliente). No es el mismo patrón que el resto de los routers anidados a
 * propósito.
 */
export const budgetRouter = Router({ mergeParams: true });

budgetRouter.use(isAuthenticated, requireProjectAccess, requireProjectOwner);

budgetRouter.get('/', getBudget);
budgetRouter.post('/', createBudget);

export default budgetRouter;
