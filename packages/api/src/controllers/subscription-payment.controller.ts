import type { NextFunction, Request, Response } from 'express';
import {
  bolivaresPaymentSchema,
  reviewSubscriptionPaymentSchema,
  type SubscriptionPaymentStatus,
} from '@luma/shared';
import { STORAGE_CONFIG } from '../config/app.config.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { uploadSubscriptionReceipt } from '../services/storage.service.js';
import {
  bolivaresQuote,
  reviewSubscriptionPayment as review,
  submitBolivaresPayment,
  toAdminPayments,
  toPaymentSummary,
} from '../services/subscription-payment.service.js';
import { badRequest, notFound, serviceUnavailable, unauthenticated } from '../utils/errors.js';

const RECEIPT_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

async function myOrganization(req: Request): Promise<string> {
  if (!req.user) throw unauthenticated();
  const organizationId = await findMyOrganizationId(req.user.sub);
  if (!organizationId) throw notFound('No encontramos tu Empresa.');
  return organizationId;
}

/** `GET /api/subscription/quote?activateNow=true` — cuánto pagar hoy en bolívares y dónde. */
export async function getBolivaresQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);
    const activateNow = req.query.activateNow === 'true';
    return res.json({ success: true, data: await bolivaresQuote(organizationId, activateNow) });
  } catch (error) {
    next(error);
  }
}

/**
 * `POST /api/subscription/payments` — multipart: los campos del pago y el
 * comprobante en `receipt`.
 *
 * El comprobante es obligatorio donde hay storage. En un entorno sin storage
 * (desarrollo) se acepta sin archivo, para poder probar el flujo; si igual
 * mandan uno, 503 como en el resto de la app.
 */
export async function createBolivaresPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);

    const parsed = bolivaresPaymentSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const file = req.file;
    if (!file && STORAGE_CONFIG.ENABLED) throw badRequest('Adjuntá el comprobante del pago.');
    if (file && !STORAGE_CONFIG.ENABLED) {
      throw serviceUnavailable('La carga de comprobantes todavía no está configurada en este entorno');
    }

    let uploadReceipt;
    if (file) {
      const extension = RECEIPT_MIME_TO_EXTENSION[file.mimetype];
      if (!extension) {
        throw badRequest('Comprobante no soportado. Subí un PDF o una imagen .jpg, .png o .webp');
      }
      uploadReceipt = async () => {
        const { key } = await uploadSubscriptionReceipt({
          organizationId,
          buffer: file.buffer,
          contentType: file.mimetype,
          extension,
        });
        return {
          key,
          fileName: file.originalname,
          contentType: file.mimetype,
          sizeBytes: file.size,
        };
      };
    }

    const payment = await submitBolivaresPayment({
      organizationId,
      userId: req.user!.sub,
      input: parsed.data,
      uploadReceipt,
    });

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
    const [dto] = await toAdminPayments([payment]);
    return res.json({ success: true, data: { payment: dto } });
  } catch (error) {
    next(error);
  }
}
