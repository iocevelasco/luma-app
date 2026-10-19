import mongoose from 'mongoose';
import {
  PLAN,
  activeProjectsAt,
  nextPeriodStart,
  subscriptionState,
  type ChargeLine,
  type StripeSubscriptionStatus,
} from '@luma/shared';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { Organization } from '../models/Organization.js';
import { StripeEvent } from '../models/StripeEvent.js';
import { Subscription } from '../models/Subscription.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { appUrl } from '../utils/app-url.js';
import { badRequest, conflict, notFound, serviceUnavailable } from '../utils/errors.js';
import { stripeRequest } from './stripe.client.js';
import { billableProjects, loadFacts } from './subscription.service.js';

/**
 * Suscripción con tarjeta, en dólares, vía Stripe.
 *
 * Reparto de responsabilidades:
 * - **Stripe cobra**: la renovación mensual, los reintentos si falla, el
 *   prorrateo de una obra extra creada a mitad de mes y la baja.
 * - **Nosotros decidimos el acceso**, con las mismas reglas de
 *   `@luma/shared/billing` que para los bolívares. Stripe nos cuenta qué pasó
 *   (webhooks) y guardamos esos hechos: estado y período en `Subscription`,
 *   y cada factura cobrada como un `SubscriptionPayment` aprobado.
 *
 * El mes gratis lo maneja Luma, no Stripe: arranca al registrarse, sin
 * tarjeta. Quien carga la tarjeta durante la prueba recibe en Stripe un
 * `trial_end` igual al fin de su prueba, así no se le cobra antes ni pierde
 * días (regla 3).
 */

type OrgId = mongoose.Types.ObjectId | string;

/** La pantalla de Suscripción del panel: a donde vuelve la persona desde Stripe. */
const SUBSCRIPTION_PAGE = '/admin/settings/subscription';

/** Stripe exige que un `trial_end` de Checkout esté al menos 48 horas en el futuro. */
const MIN_TRIAL_SECONDS = 48 * 60 * 60 + 60;

/** Estados en los que la suscripción de Stripe sigue viva y hay que gestionarla, no crear otra. */
const LIVE_STRIPE_STATUSES: readonly StripeSubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
];

function ensureEnabled() {
  if (!STRIPE_CONFIG.ENABLED) throw serviceUnavailable('El pago con tarjeta no está habilitado.');
}

// ─────────────────────────────── Precios ───────────────────────────────

interface StripePrice {
  id: string;
  lookup_key: string | null;
  unit_amount: number | null;
  currency: string;
}

let priceCache: { base: string; extra: string } | null = null;

/** Los dos precios por `lookup_key`. Se cachean: no cambian mientras corre el proceso. */
export async function resolvePrices(): Promise<{ base: string; extra: string }> {
  if (priceCache) return priceCache;
  const keys = [STRIPE_CONFIG.BASE_PRICE_LOOKUP_KEY, STRIPE_CONFIG.EXTRA_PRICE_LOOKUP_KEY];
  const { data } = await stripeRequest<{ data: StripePrice[] }>('GET', '/prices', {
    lookup_keys: keys,
    active: true,
  });
  const base = data.find((p) => p.lookup_key === keys[0]);
  const extra = data.find((p) => p.lookup_key === keys[1]);
  if (!base || !extra) {
    throw serviceUnavailable(
      'Faltan los precios en Stripe. Corré `pnpm --filter @luma/api stripe:setup`.',
    );
  }
  priceCache = { base: base.id, extra: extra.id };
  return priceCache;
}

/** Sólo para los tests. */
export function resetPriceCache() {
  priceCache = null;
}

// ─────────────────────────────── Checkout y Portal ───────────────────────────────

async function ensureCustomer(organizationId: OrgId, userId: string): Promise<string> {
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription) throw badRequest('Tu mes gratis arranca con tu primera obra.');
  if (subscription.stripeCustomerId) return subscription.stripeCustomerId;

  const [user, organization] = await Promise.all([
    User.findById(userId).select('email name'),
    Organization.findById(organizationId).select('name'),
  ]);
  const customer = await stripeRequest<{ id: string }>(
    'POST',
    '/customers',
    {
      email: user?.email,
      name: organization?.name ?? user?.name,
      metadata: { organizationId: String(organizationId), userId },
    },
    // Dos clicks seguidos no crean dos clientes.
    { idempotencyKey: `customer-${String(organizationId)}` },
  );
  await Subscription.updateOne(
    { organization: organizationId, stripeCustomerId: null },
    { $set: { stripeCustomerId: customer.id } },
  );
  return customer.id;
}

/**
 * Arma la página de pago de Stripe y devuelve su URL.
 *
 * - Normal: base + las extras activas hoy. Si todavía le queda prueba (o un
 *   período ya pago en Bs), Stripe espera hasta entonces para cobrar.
 * - `activateNow` (sólo en prueba, para crear la cuarta): cobra ya, base + la
 *   extra que va a crear; la prueba termina cuando Stripe confirma el pago.
 */
export async function createCheckoutSession(params: {
  organizationId: OrgId;
  userId: string;
  activateNow: boolean;
  now?: Date;
}): Promise<{ url: string }> {
  ensureEnabled();
  const now = params.now ?? new Date();
  const [facts, projects, subscription] = await Promise.all([
    loadFacts(params.organizationId),
    billableProjects(params.organizationId),
    Subscription.findOne({ organization: params.organizationId }),
  ]);
  const state = subscriptionState(facts, now);

  if (state.status === 'sin_iniciar' || !subscription) {
    throw badRequest('Tu mes gratis arranca con tu primera obra: todavía no hay nada que pagar.');
  }
  if (subscription.stripeStatus && LIVE_STRIPE_STATUSES.includes(subscription.stripeStatus)) {
    throw conflict('Ya tenés el pago con tarjeta activo. Gestionalo desde "Administrar tarjeta".');
  }
  if (state.status === 'en_revision') {
    throw conflict('Tenés un pago en bolívares en revisión. Esperá a que lo revisemos.');
  }
  if (params.activateNow && state.status !== 'prueba') {
    throw badRequest('Activar el plan antes de tiempo sólo tiene sentido durante el mes gratis.');
  }

  const active = activeProjectsAt(projects, now) + (params.activateNow ? 1 : 0);
  const extras = Math.max(0, active - PLAN.includedProjects);
  const prices = await resolvePrices();
  const customer = await ensureCustomer(params.organizationId, params.userId);

  const startsAt = params.activateNow ? now : nextPeriodStart(facts, now);
  const trialEnd = Math.floor(startsAt.getTime() / 1000);
  const deferred = trialEnd - Math.floor(now.getTime() / 1000) >= MIN_TRIAL_SECONDS;

  const metadata = {
    organizationId: String(params.organizationId),
    activateNow: String(params.activateNow),
  };

  const session = await stripeRequest<{ url: string }>('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: String(params.organizationId),
    line_items: [
      { price: prices.base, quantity: 1 },
      ...(extras > 0 ? [{ price: prices.extra, quantity: extras }] : []),
    ],
    subscription_data: {
      metadata,
      // Menos de 48 horas no se puede diferir: arranca hoy y pierde ese resto.
      trial_end: deferred ? trialEnd : undefined,
    },
    metadata,
    locale: 'es',
    success_url: appUrl(`${SUBSCRIPTION_PAGE}?stripe=ok`),
    cancel_url: appUrl(`${SUBSCRIPTION_PAGE}?stripe=cancel`),
  });
  return { url: session.url };
}

/** El portal de Stripe: cambiar tarjeta, ver facturas, dar de baja. */
export async function createPortalSession(organizationId: OrgId): Promise<{ url: string }> {
  ensureEnabled();
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (!subscription?.stripeCustomerId) throw notFound('Todavía no cargaste una tarjeta.');

  const session = await stripeRequest<{ url: string }>('POST', '/billing_portal/sessions', {
    customer: subscription.stripeCustomerId,
    return_url: appUrl(SUBSCRIPTION_PAGE),
  });
  return { url: session.url };
}

// ─────────────────────────────── Extras ───────────────────────────────

interface StripeSubscriptionItem {
  id: string;
  quantity?: number;
  price: { id: string };
  current_period_start?: number;
  current_period_end?: number;
}

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: StripeSubscriptionStatus;
  metadata?: Record<string, string>;
  current_period_start?: number;
  current_period_end?: number;
  items: { data: StripeSubscriptionItem[] };
}

/**
 * Lleva la cantidad de obras extra de Stripe a las activas de hoy. Se llama
 * después de crear una obra.
 *
 * - Sube: Stripe prorratea el resto del mes y lo cobra en la próxima factura
 *   (regla 5).
 * - Baja: sin devolver nada (regla 6); deja de cobrarse desde la renovación.
 */
export async function syncStripeExtras(organizationId: OrgId, now: Date = new Date()) {
  if (!STRIPE_CONFIG.ENABLED) return;
  const subscription = await Subscription.findOne({ organization: organizationId });
  if (
    !subscription?.stripeSubscriptionId ||
    !subscription.stripeStatus ||
    !['active', 'trialing', 'past_due'].includes(subscription.stripeStatus)
  ) {
    return;
  }

  const [projects, prices, remote] = await Promise.all([
    billableProjects(organizationId),
    resolvePrices(),
    stripeRequest<StripeSubscriptionObject>(
      'GET',
      `/subscriptions/${subscription.stripeSubscriptionId}`,
    ),
  ]);
  const desired = Math.max(0, activeProjectsAt(projects, now) - PLAN.includedProjects);
  const item = remote.items.data.find((i) => i.price.id === prices.extra);
  const current = item?.quantity ?? 0;
  if (desired === current) return;

  const proration_behavior = desired > current ? 'create_prorations' : 'none';
  if (!item) {
    await stripeRequest('POST', '/subscription_items', {
      subscription: remote.id,
      price: prices.extra,
      quantity: desired,
      proration_behavior,
    });
  } else if (desired === 0) {
    await stripeRequest('DELETE', `/subscription_items/${item.id}`, { proration_behavior });
  } else {
    await stripeRequest('POST', `/subscription_items/${item.id}`, {
      quantity: desired,
      proration_behavior,
    });
  }
}

// ─────────────────────────────── Webhooks ───────────────────────────────

/**
 * El período actual. En la API de Stripe desde 2025-03-31 vive en cada ítem,
 * antes en la suscripción: el webhook puede llegar en cualquiera de las dos
 * versiones según cómo esté configurado el endpoint.
 */
function periodOf(sub: StripeSubscriptionObject): { start: Date; end: Date } | null {
  const start = sub.current_period_start ?? sub.items.data[0]?.current_period_start;
  const end = sub.current_period_end ?? sub.items.data[0]?.current_period_end;
  return start && end ? { start: new Date(start * 1000), end: new Date(end * 1000) } : null;
}

async function organizationFor(customer: string, metadata?: Record<string, string>) {
  if (metadata?.organizationId) return metadata.organizationId;
  const subscription = await Subscription.findOne({ stripeCustomerId: customer }).select(
    'organization',
  );
  return subscription ? String(subscription.organization) : null;
}

/** Guarda lo que Stripe dice de la suscripción. Idempotente: es un `$set`. */
export async function syncSubscriptionFromStripe(sub: StripeSubscriptionObject) {
  const organizationId = await organizationFor(sub.customer, sub.metadata);
  if (!organizationId) {
    console.warn(`⚠️  [STRIPE] Suscripción ${sub.id} sin Empresa conocida`);
    return;
  }
  const period = periodOf(sub);

  await Subscription.updateOne(
    { organization: organizationId },
    {
      $set: {
        stripeCustomerId: sub.customer,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        ...(period
          ? { stripeCurrentPeriodStart: period.start, stripeCurrentPeriodEnd: period.end }
          : {}),
      },
    },
  );

  // Activó desde la prueba para crear la cuarta: la prueba termina cuando
  // arranca el período pago. Una sola vez (el filtro lo garantiza).
  if (sub.metadata?.activateNow === 'true' && sub.status === 'active' && period) {
    await Subscription.updateOne(
      {
        organization: organizationId,
        trialEndedEarlyAt: null,
        trialEndsAt: { $gt: period.start },
      },
      { $set: { trialEndedEarlyAt: period.start } },
    );
  }
}

interface StripeInvoiceLine {
  amount: number;
  quantity?: number | null;
  period?: { start: number; end: number };
  proration?: boolean;
  price?: { id: string } | null;
  pricing?: { price_details?: { price?: string } } | null;
  parent?: { subscription_item_details?: { proration?: boolean } } | null;
}

interface StripeInvoice {
  id: string;
  customer: string;
  currency: string;
  amount_paid: number;
  status_transitions?: { paid_at?: number | null };
  lines: { data: StripeInvoiceLine[] };
  subscription_details?: { metadata?: Record<string, string> } | null;
  parent?: { subscription_details?: { metadata?: Record<string, string> } } | null;
}

/**
 * Una factura cobrada queda como un `SubscriptionPayment` aprobado: el mismo
 * historial que los pagos en bolívares, y un período cubierto que sigue
 * valiendo aunque después se dé de baja la suscripción.
 *
 * Las de $0 (la que emite Stripe al arrancar una prueba) no se registran.
 */
export async function recordPaidInvoice(invoice: StripeInvoice) {
  if (invoice.amount_paid <= 0) return;
  if (invoice.currency !== 'usd') {
    console.warn(`⚠️  [STRIPE] Factura ${invoice.id} en ${invoice.currency}, se esperaba usd`);
  }

  const metadata =
    invoice.parent?.subscription_details?.metadata ?? invoice.subscription_details?.metadata;
  const organizationId = await organizationFor(invoice.customer, metadata);
  if (!organizationId) {
    console.warn(`⚠️  [STRIPE] Factura ${invoice.id} sin Empresa conocida`);
    return;
  }

  const prices = await resolvePrices();
  const lines: ChargeLine[] = invoice.lines.data.map((line) => {
    const priceId = line.price?.id ?? line.pricing?.price_details?.price;
    const proration = line.proration ?? line.parent?.subscription_item_details?.proration ?? false;
    const quantity = line.quantity ?? 1;
    const amountUsd = line.amount / 100;
    const kind: ChargeLine['kind'] = proration
      ? 'prorrateo'
      : priceId === prices.base
        ? 'base'
        : 'extra';
    return { kind, quantity, unitUsd: quantity ? amountUsd / quantity : amountUsd, amountUsd };
  });

  // El período que cubre: el de las líneas que no son prorrateo (el mes que
  // se paga por adelantado). Un prorrateo es del mes que ya pasó.
  const periods = invoice.lines.data
    .filter((line, i) => line.period && lines[i]!.kind !== 'prorrateo')
    .map((line) => line.period!);
  if (periods.length === 0) {
    console.warn(`⚠️  [STRIPE] Factura ${invoice.id} sin período: no se registra`);
    return;
  }
  const start = new Date(Math.min(...periods.map((p) => p.start)) * 1000);
  const end = new Date(Math.max(...periods.map((p) => p.end)) * 1000);
  const paidAt = new Date((invoice.status_transitions?.paid_at ?? Date.now() / 1000) * 1000);

  await SubscriptionPayment.updateOne(
    { stripeInvoiceId: invoice.id },
    {
      $setOnInsert: {
        organization: organizationId,
        method: 'stripe',
        status: 'aprobado',
        periodStart: start,
        periodEnd: end,
        lines,
        totalUsd: invoice.amount_paid / 100,
        stripeInvoiceId: invoice.id,
        submittedAt: paidAt,
        reviewedAt: paidAt,
      },
    },
    { upsert: true },
  );
}

export interface StripeEventPayload {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Procesa un evento ya verificado. Devuelve `false` si ya lo habíamos
 * procesado. Si algo falla, borra la marca para que el reintento de Stripe
 * lo vuelva a intentar.
 */
export async function handleStripeEvent(event: StripeEventPayload): Promise<boolean> {
  try {
    await StripeEvent.create({ eventId: event.id, type: event.type });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }

  try {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        const subscriptionId = object.subscription as string | null;
        if (subscriptionId) {
          await syncSubscriptionFromStripe(
            await stripeRequest<StripeSubscriptionObject>('GET', `/subscriptions/${subscriptionId}`),
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscriptionFromStripe(object as unknown as StripeSubscriptionObject);
        break;
      case 'invoice.paid':
        await recordPaidInvoice(object as unknown as StripeInvoice);
        break;
      default:
        // `invoice.payment_failed` y el resto: el estado nuevo (past_due)
        // llega igual por `customer.subscription.updated`.
        break;
    }
    return true;
  } catch (error) {
    await StripeEvent.deleteOne({ eventId: event.id });
    throw error;
  }
}
