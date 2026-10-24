import { Router } from 'express';
import { isAuthenticated, requireAdmin } from '../middleware/auth.middleware.js';
import {
  createManualExchangeRate,
  getPlatformUsersOverview,
  listExchangeRates,
  listPlatformUsersPage,
  listSubscriptionPaymentsForAdmin,
  refreshExchangeRateNow,
  reviewSubscriptionPayment,
} from '../controllers/index.js';

/**
 * Lo que sólo hace el admin de la plataforma (`role: 'admin'`): no es un rol
 * de obra ni de Empresa, es quien opera Luma: la tasa del BCV, la cola de
 * pagos de la suscripción en bolívares y, sólo lectura, las cuentas registradas.
 */
export const adminRouter = Router();

adminRouter.use(isAuthenticated, requireAdmin);

adminRouter.get('/exchange-rates', listExchangeRates);
adminRouter.post('/exchange-rates', createManualExchangeRate);
adminRouter.post('/exchange-rates/refresh', refreshExchangeRateNow);

adminRouter.get('/users/overview', getPlatformUsersOverview);
adminRouter.get('/users', listPlatformUsersPage);

adminRouter.get('/subscription-payments',listSubscriptionPaymentsForAdmin);
adminRouter.post('/subscription-payments/:paymentId/review', reviewSubscriptionPayment);

export default adminRouter;
