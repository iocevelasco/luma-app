import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import { createBudget, getBudget } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/budget` — ver routes/project.ts.
 *
 * El gate va a nivel de `.use()` e incluye el GET: ni el cliente ni el
 * supervisor ven presupuesto (regla 13 — la utilidad del ejecutante nunca es
 * visible para el cliente, y la matriz de roles no le da economía al
 * supervisor). `budget.read` lo tiene sólo el gerente.
 */
export const budgetRouter = Router({ mergeParams: true });

budgetRouter.use(isAuthenticated, requireProjectAccess, requireCapability('budget.read'));

budgetRouter.get('/', getBudget);
budgetRouter.post('/', requireCapability('budget.write'), createBudget);

export default budgetRouter;
