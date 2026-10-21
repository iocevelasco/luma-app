import type { NextFunction, Request, Response } from 'express';
import type { SubscriptionOverview } from '@luma/shared';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { Subscription } from '../models/Subscription.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { receivingAccounts } from '../services/subscription-payment.service.js';
import { summaryFor } from '../services/subscription.service.js';
import { notFound, unauthenticated } from '../utils/errors.js';

/**
 * `GET /api/subscription/me` — el estado de la suscripción de MI Empresa:
 * prueba, activa o vencida, hasta cuándo, cuántas obras cuentan, cuánto es
 * el próximo cobro y con qué se puede pagar. Todo derivado en el momento.
 */
export async function getMySubscription(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();

    const organizationId = await findMyOrganizationId(req.user.sub);
    if (!organizationId) throw notFound('No encontramos tu Empresa.');

    const [summary, subscription] = await Promise.all([
      summaryFor(organizationId),
      Subscription.findOne({ organization: organizationId }).select(
        'stripeStatus stripeCustomerId',
      ),
    ]);
    const accounts = receivingAccounts();

    const overview: SubscriptionOverview = {
      ...summary,
      paymentOptions: {
        card: STRIPE_CONFIG.ENABLED,
        bolivares: Boolean(accounts.pagoMovil || accounts.transferencia),
      },
      card: {
        status: subscription?.stripeStatus ?? null,
        manageable: Boolean(subscription?.stripeCustomerId),
      },
    };
    return res.json({ success: true, data: { subscription: overview } });
  } catch (error) {
    next(error);
  }
}
