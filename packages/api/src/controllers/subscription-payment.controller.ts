import type { NextFunction, Request, Response } from 'express';
import {
  binancePaymentSchema,
  bolivaresPaymentSchema,
  planCodeSchema,
  reviewSubscriptionPaymentSchema,
  SUBSCRIPTION_RECEIPT_EXTENSIONS,
  type PaymentSetupStatus,
  type SubscriptionPaymentStatus,
} from '@luma/shared';
import {
  BINANCE_PAYMENT_CONFIG,
  BS_PAYMENT_CONFIG,
  STORAGE_CONFIG,
  STRIPE_CONFIG,
} from '../config/app.config.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { uploadSubscriptionReceipt } from '../services/storage.service.js';
import {
  notifyPaymentReviewed,
  notifyPaymentToReview,
} from '../services/subscription-notify.service.js';
import {
  binanceQuote,
  bolivaresQuote,
  reviewSubscriptionPayment as review,
  submitBinancePayment,
  submitBolivaresPayment,
  toAdminPayments,
  toPaymentSummary,
} from '../services/subscription-payment.service.js';
import { badRequest, notFound, serviceUnavailable, unauthenticated } from '../utils/errors.js';

async function myOrganization(req: Request): Promise<string> {
  if (!req.user) throw unauthenticated();
  const organizationId = await findMyOrganizationId(req.user.sub);
  if (!organizationId) throw notFound('No encontramos tu Empresa.');
  return organizationId;
}

/**
 * Valida el comprobante y devuelve cómo subirlo, sin subirlo todavía. Es
 * obligatorio donde hay storage; en un entorno sin storage (desarrollo) se
 * acepta sin archivo, para poder probar el flujo, y si igual mandan uno, 503.
 */
function receiptUploader(req: Request, organizationId: string) {
  const file = req.file;
  if (!file && STORAGE_CONFIG.ENABLED) throw badRequest('Adjunta el comprobante del pago.');
  if (file && !STORAGE_CONFIG.ENABLED) {
    throw serviceUnavailable('La carga de comprobantes todavía no está configurada en este entorno');
  }
  if (!file) return undefined;

  const extension = SUBSCRIPTION_RECEIPT_EXTENSIONS[file.mimetype];
  if (!extension) {
    throw badRequest('Comprobante no soportado. Sube un PDF o una imagen .jpg, .png o .webp');
  }
  return async () => {
    const { key } = await uploadSubscriptionReceipt({
      organizationId,
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    });
    return { key, fileName: file.originalname, contentType: file.mimetype, sizeBytes: file.size };
  };
}

/**
 * `GET /api/subscription/quote?activateNow=true&includeNextProject=true` —
 * cuánto pagar hoy en bolívares y dónde.
 */
export async function getBolivaresQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);
    const activateNow = req.query.activateNow === 'true';
    const includeNextProject = req.query.includeNextProject === 'true';
    const plan = planCodeSchema.optional().safeParse(req.query.plan);
    if (!plan.success) throw badRequest('Plan inválido', plan.error.issues);
    return res.json({
      success: true,
      data: await bolivaresQuote(organizationId, activateNow, new Date(), includeNextProject, plan.data),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * `POST /api/subscription/payments` — multipart: los campos del pago y el
 * comprobante en `receipt`.
 */
export async function createBolivaresPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);

    const parsed = bolivaresPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const payment = await submitBolivaresPayment({
      organizationId,
      userId: req.user!.sub,
      input: parsed.data,
      uploadReceipt: receiptUploader(req, organizationId),
    });

    // Al admin, por mail: hay un pago para revisar. No espera ni falla el alta.
    void notifyPaymentToReview(payment);

    return res.status(201).json({ success: true, data: { payment: await toPaymentSummary(payment) } });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/subscription/quote/binance` — cuánto pagar hoy en USDT y a qué cuenta. */
export async function getBinanceQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);
    const activateNow = req.query.activateNow === 'true';
    const includeNextProject = req.query.includeNextProject === 'true';
    const plan = planCodeSchema.optional().safeParse(req.query.plan);
    if (!plan.success) throw badRequest('Plan inválido', plan.error.issues);
    return res.json({
      success: true,
      data: await binanceQuote(organizationId, activateNow, new Date(), includeNextProject, plan.data),
    });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/subscription/payments/binance` — multipart, como el de bolívares. */
export async function createBinancePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);

    const parsed = binancePaymentSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const payment = await submitBinancePayment({
      organizationId,
      userId: req.user!.sub,
      input: parsed.data,
      uploadReceipt: receiptUploader(req, organizationId),
    });

    void notifyPaymentToReview(payment);

    return res.status(201).json({ success: true, data: { payment: await toPaymentSummary(payment) } });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/subscription/payments` — el historial de pagos de mi Empresa. */
export async function listMySubscriptionPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);
    const payments = await SubscriptionPayment.find({ organization: organizationId })
      .sort({ submittedAt: -1 })
      .limit(100);
    return res.json({
      success: true,
      data: { payments: await Promise.all(payments.map(toPaymentSummary)) },
    });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/admin/payment-setup` — qué medios de pago están activos en este entorno. */
export function getPaymentSetup(_req: Request, res: Response) {
  const setup: PaymentSetupStatus = {
    card: STRIPE_CONFIG.ENABLED,
    pagoMovil: Boolean(BS_PAYMENT_CONFIG.PAGO_MOVIL),
    transferencia: Boolean(BS_PAYMENT_CONFIG.TRANSFERENCIA),
    binance: Boolean(BINANCE_PAYMENT_CONFIG),
    receipts: STORAGE_CONFIG.ENABLED,
  };
  return res.json({ success: true, data: { setup } });
}

const REVIEWABLE_STATUSES: readonly SubscriptionPaymentStatus[] = [
  'pendiente',
  'aprobado',
  'rechazado',
];

/**
 * `GET /api/admin/subscription-payments?status=pendiente` — la cola del admin.
 * Los pendientes salen en orden de llegada (el más viejo primero: es el que
 * más tiempo lleva esperando); el resto, del más nuevo al más viejo.
 */
export async function listSubscriptionPaymentsForAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = (req.query.status as SubscriptionPaymentStatus | undefined) ?? 'pendiente';
    if (!REVIEWABLE_STATUSES.includes(status)) throw badRequest('Estado inválido');

    const payments = await SubscriptionPayment.find({ status, method: { $ne: 'stripe' } })
      .sort({ submittedAt: status === 'pendiente' ? 1 : -1 })
      .limit(200);
    return res.json({ success: true, data: { payments: await toAdminPayments(payments) } });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/subscription-payments/:paymentId/review` — aprobar o rechazar. */
export async function reviewSubscriptionPayment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    const parsed = reviewSubscriptionPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const payment = await review({
      paymentId: String(req.params.paymentId),
      adminId: req.user.sub,
      decision: parsed.data,
    });
    // Al dueño, por mail: aprobado o rechazado con el motivo.
    void notifyPaymentReviewed(payment);

    const [dto] = await toAdminPayments([payment]);
    return res.json({ success: true, data: { payment: dto } });
  } catch (error) {
    next(error);
  }
}
