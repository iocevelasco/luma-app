import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  createBolivaresPayment,
  getBolivaresQuote,
  getCurrentRate,
  getMySubscription,
  listMySubscriptionPayments,
  openStripePortal,
  startStripeCheckout,
} from '../controllers/index.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES } });

function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: 'El comprobante es demasiado grande (máximo 20MB)',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }
  next(err);
}

/**
 * La suscripción de MI Empresa a Luma. Sin `requireWritableSubscription` a
 * propósito: es justo por acá que alguien vencido tiene que poder pagar.
 */
export const subscriptionRouter = Router();

subscriptionRouter.use(isAuthenticated);

subscriptionRouter.get('/me', getMySubscription);
subscriptionRouter.get('/rate', getCurrentRate);
subscriptionRouter.get('/quote', getBolivaresQuote);
subscriptionRouter.get('/payments', listMySubscriptionPayments);
subscriptionRouter.post(
  '/payments',
  upload.single('receipt'),
  handleUploadError,
  createBolivaresPayment,
);

subscriptionRouter.post('/stripe/checkout', startStripeCheckout);
subscriptionRouter.post('/stripe/portal', openStripePortal);

export default subscriptionRouter;
