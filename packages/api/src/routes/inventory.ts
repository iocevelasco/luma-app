import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  importFromDepositHandler,
  listDepositForImport,
  sendToDepositHandler,
} from '../controllers/deposit.controller.js';
import { createMovement, listMovements, listStock } from '../controllers/inventory.controller.js';

/**
 * Anidado bajo `/api/projects/:projectId/inventory` — ver routes/project.ts.
 *
 * Sin PATCH ni DELETE a propósito: el kardex es historia. Una corrección es
 * otro movimiento.
 */
export const inventoryRouter = Router({ mergeParams: true });

inventoryRouter.use(isAuthenticated, requireProjectAccess);

inventoryRouter.get('/stock', requireCapability('inventory.read'), listStock);
inventoryRouter.get('/movements', requireCapability('inventory.read'), listMovements);
inventoryRouter.post('/movements', requireCapability('inventory.write'), createMovement);

// Depósito General: es de la Empresa, así que sólo el dueño de la obra
// (`inventory.deposit.write`, ver `OWNER_ONLY`). Sin PATCH ni DELETE, igual que el kardex.
inventoryRouter.get('/deposit', requireCapability('inventory.deposit.write'), listDepositForImport);
inventoryRouter.post(
  '/deposit/send',
  requireCapability('inventory.deposit.write'),
  sendToDepositHandler,
);
inventoryRouter.post(
  '/deposit/import',
  requireCapability('inventory.deposit.write'),
  importFromDepositHandler,
);

export default inventoryRouter;
