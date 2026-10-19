import type { NextFunction, Request, Response } from 'express';
import { findMyOrganizationId } from '../services/organization.service.js';
import { summaryFor } from '../services/subscription.service.js';
import { notFound, unauthenticated } from '../utils/errors.js';

/**
 * `GET /api/subscription/me` — el estado de la suscripción de MI Empresa:
 * prueba, activa o vencida, hasta cuándo, cuántas obras cuentan y cuánto es
 * el próximo cobro. Todo derivado en el momento; nada de esto se guarda.
 */
export async function getMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();

    const organizationId = await findMyOrganizationId(req.user.sub);
    if (!organizationId) throw notFound('No encontramos tu Empresa.');

    return res.json({ success: true, data: { subscription: await summaryFor(organizationId) } });
  } catch (error) {
    next(error);
  }
}
