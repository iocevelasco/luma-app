import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { CAMPAIGN_IMAGE_MAX_BYTES } from '@luma/shared';
import { isAuthenticated, requireAdmin } from '../middleware/auth.middleware.js';
import {
  createCampaign,
  createManualExchangeRate,
  deleteCampaign,
  getCampaignAudience,
  listCampaigns,
  sendCampaign,
  sendCampaignTest,
  getChatPrompt,
  getPlatformFeedback,
  getPlatformActivity,
  getPlatformCensus,
  getPlatformFunnel,
  getPlatformUsersOverview,
  getPaymentSetup,
  getPlanCatalog,
  listExchangeRates,
  publishPlanConfig,
  listPlatformFollowUp,
  listPlatformUsersPage,
  setPlatformUserUnlimited,
  listSubscriptionPaymentsForAdmin,
  refreshExchangeRateNow,
  reviewSubscriptionPayment,
  updateChatPrompt,
} from '../controllers/index.js';

/**
 * Lo que sólo hace el admin de la plataforma (`role: 'admin'`): no es un rol
 * de obra ni de Empresa, es quien opera Luma: la tasa del BCV, la cola de
 * pagos de la suscripción en bolívares, el prompt del asistente, la
 * actividad por rol y las cuentas registradas. Desde las cuentas asigna
 * el plan ilimitado; el resto de esa pantalla es de consulta.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CAMPAIGN_IMAGE_MAX_BYTES },
});

/** El límite de tamaño de multer llega como error acá, antes del errorHandler global. */
function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'La imagen es demasiado grande (máximo 2MB)' });
  }
  next(err);
}

export const adminRouter = Router();

adminRouter.use(isAuthenticated, requireAdmin);

adminRouter.get('/exchange-rates', listExchangeRates);
adminRouter.post('/exchange-rates', createManualExchangeRate);
adminRouter.post('/exchange-rates/refresh', refreshExchangeRateNow);

adminRouter.get('/users/overview', getPlatformUsersOverview);
adminRouter.get('/users/census', getPlatformCensus);
adminRouter.get('/users/funnel', getPlatformFunnel);
adminRouter.get('/users/follow-up', listPlatformFollowUp);
adminRouter.get('/users', listPlatformUsersPage);
adminRouter.post('/users/:userId/unlimited', setPlatformUserUnlimited);

adminRouter.get('/chat-prompt', getChatPrompt);
adminRouter.put('/chat-prompt', updateChatPrompt);

adminRouter.get('/activity', getPlatformActivity);
adminRouter.get('/feedback', getPlatformFeedback);

adminRouter.get('/plan-config', getPlanCatalog);
adminRouter.post('/plan-config', publishPlanConfig);
adminRouter.get('/payment-setup', getPaymentSetup);
adminRouter.get('/subscription-payments', listSubscriptionPaymentsForAdmin);
adminRouter.post('/subscription-payments/:paymentId/review', reviewSubscriptionPayment);

adminRouter.get('/campaigns', listCampaigns);
adminRouter.get('/campaigns/audience', getCampaignAudience);
adminRouter.post('/campaigns', upload.single('image'), handleUploadError, createCampaign);
adminRouter.post('/campaigns/:id/test', sendCampaignTest);
adminRouter.post('/campaigns/:id/send', sendCampaign);
adminRouter.delete('/campaigns/:id', deleteCampaign);

export default adminRouter;
