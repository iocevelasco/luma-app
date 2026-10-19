import { Router } from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/auth.middleware.js';
import {
  createManualExchangeRate,
  listExchangeRates,
  refreshExchangeRateNow,
} from '../controllers/index.js';

/**
 * Lo que sólo hace el admin de la plataforma (`role: 'admin'`): no es un rol
 * de obra ni de Empresa, es quien opera Luma. Por ahora, la tasa del BCV; la
 * cola de pagos en bolívares se suma en la entrega 4.
 */
export const adminRouter = Router();

adminRouter.use(isAuthenticated, requireAdmin);

adminRouter.get('/exchange-rates', listExchangeRates);
adminRouter.post('/exchange-rates', createManualExchangeRate);
adminRouter.post('/exchange-rates/refresh', refreshExchangeRateNow);

export default adminRouter;
