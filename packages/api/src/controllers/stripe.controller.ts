import type { NextFunction, Request, Response } from 'express';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { StripeSignatureError, verifyStripeSignature } from '../services/stripe.client.js';
import {
  createCheckoutSession,
  createPortalSession,
  handleStripeEvent,
  type StripeEventPayload,
} from '../services/stripe.service.js';
import { notFound, unauthenticated } from '../utils/errors.js';

async function myOrganization(req: Request): Promise<string> {
  if (!req.user) throw unauthenticated();
  const organizationId = await findMyOrganizationId(req.user.sub);
  if (!organizationId) throw notFound('No encontramos tu Empresa.');
  return organizationId;
}

/**
 * `POST /api/subscription/stripe/checkout` `{ activateNow?, includeNextProject? }`
 * → `StripeCheckoutStart`: el `clientSecret` para el modal, o la `url` de la
 * página de Stripe si no hay publishable key.
 */
export async function startStripeCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = await myOrganization(req);
    const start = await createCheckoutSession({
      organizationId,
      userId: req.user!.sub,
      activateNow: req.body?.activateNow === true,
      includeNextProject: req.body?.includeNextProject === true,
    });
    return res.json({ success: true, data: start });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/subscription/stripe/portal` → `{ url }` del portal de Stripe. */
export async function openStripePortal(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = await createPortalSession(await myOrganization(req));
    return res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
}

/**
 * `POST /api/billing/stripe/webhook` — lo llama Stripe, no una persona.
 *
 * Sin sesión: lo que lo autentica es la firma. Se monta con `express.raw()`
 * antes de `express.json()` (ver index.ts) porque la firma es sobre el cuerpo
 * original byte por byte.
 *
 * - Firma inválida → 400 (Stripe no reintenta un 4xx… salvo que lo
 *   configures; está bien: un evento que no firmó Stripe no se procesa).
 * - Falla al procesar → 500, y Stripe reintenta.
 */
export async function stripeWebhook(req: Request, res: Response) {
  if (!STRIPE_CONFIG.WEBHOOK_SECRET) {
    return res.status(503).json({ success: false, error: 'Webhook de Stripe no configurado' });
  }

  let event: StripeEventPayload;
  try {
    verifyStripeSignature(
      req.body as Buffer,
      req.headers['stripe-signature'] as string | undefined,
      STRIPE_CONFIG.WEBHOOK_SECRET,
    );
    event = JSON.parse((req.body as Buffer).toString('utf8')) as StripeEventPayload;
  } catch (error) {
    const message = error instanceof StripeSignatureError ? error.message : 'Cuerpo inválido';
    return res.status(400).json({ success: false, error: message });
  }

  try {
    const processed = await handleStripeEvent(event);
    return res.json({ received: true, duplicate: !processed });
  } catch (error) {
    console.error(`❌ [STRIPE] ${event.type} ${event.id}:`, error);
    return res.status(500).json({ success: false, error: 'No se pudo procesar el evento' });
  }
}
