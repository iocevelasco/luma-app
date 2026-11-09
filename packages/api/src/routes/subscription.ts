import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  createBinancePayment,
  createBolivaresPayment,
  getBinanceQuote,
  getBolivaresQuote,
  getCurrentRate,
  getMySubscription,
  listMySubscriptionPayments,
  openStripePortal,
  startStripeCheckout,
} from '../controllers/index.js';
import { AppError } from '../utils/errors.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOCUMENT_MAX_BYTES } });

/** El límite de multer llega como error acá; se traduce a un error con `code`. */
export function handleUploadError(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return next(
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError('PAYLOAD_TOO_LARGE', 'El comprobante es demasiado grande (máximo 20MB).')
        : new AppError('VALIDATION', 'Sube un solo comprobante.'),
    );
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
subscriptionRouter.get('/quote/binance', getBinanceQuote);
subscriptionRouter.get('/payments', listMySubscriptionPayments);
subscriptionRouter.post(
  '/payments',
  upload.single('receipt'),
  handleUploadError,
  createBolivaresPayment,
);
subscriptionRouter.post(
  '/payments/binance',
  upload.single('receipt'),
  handleUploadError,
  createBinancePayment,
);

subscriptionRouter.post('/stripe/checkout', startStripeCheckout);
subscriptionRouter.post('/stripe/portal', openStripePortal);

export default subscriptionRouter;
