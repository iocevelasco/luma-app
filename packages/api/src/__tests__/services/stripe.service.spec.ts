import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionFacts } from '@luma/shared';

vi.mock('../../config/app.config.js', () => ({
  STRIPE_CONFIG: {
    ENABLED: true,
    SECRET_KEY: 'sk_test_x',
    BASE_PRICE_LOOKUP_KEY: 'luma_base_monthly',
    EXTRA_PRICE_LOOKUP_KEY: 'luma_extra_project_monthly',
  },
  SERVER_CONFIG: { APP_URL: 'https://luma.test/app' },
}));
vi.mock('../../services/stripe.client.js', () => ({ stripeRequest: vi.fn() }));
vi.mock('../../services/subscription-notify.service.js', () => ({ notifyCardPaymentFailed: vi.fn() }));
vi.mock('../../services/subscription.service.js', () => ({
  loadFacts: vi.fn(),
  billableProjects: vi.fn(),
}));
vi.mock('../../models/Subscription.js', () => ({
  Subscription: { findOne: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../../models/SubscriptionPayment.js', () => ({
  SubscriptionPayment: { updateOne: vi.fn() },
}));
vi.mock('../../models/StripeEvent.js', () => ({
  StripeEvent: { create: vi.fn(), deleteOne: vi.fn() },
}));
vi.mock('../../models/User.js', () => ({
  User: { findById: () => ({ select: () => Promise.resolve({ email: 'ana@obra.test', name: 'Ana' }) }) },
}));
vi.mock('../../models/Organization.js', () => ({
  Organization: { findById: () => ({ select: () => Promise.resolve({ name: 'Obras Ana' }) }) },
}));

const { stripeRequest } = await import('../../services/stripe.client.js');
const { loadFacts, billableProjects } = await import('../../services/subscription.service.js');
const { Subscription } = await import('../../models/Subscription.js');
const { SubscriptionPayment } = await import('../../models/SubscriptionPayment.js');
const { StripeEvent } = await import('../../models/StripeEvent.js');
const { notifyCardPaymentFailed } = await import('../../services/subscription-notify.service.js');
const svc = await import('../../services/stripe.service.js');

const d = (iso: string) => new Date(iso);
const sec = (iso: string) => Math.floor(d(iso).getTime() / 1000);
const NOW = d('2026-10-20T15:00:00.000Z');

const trial: SubscriptionFacts = {
  trialStartedAt: d('2026-10-10T00:00:00.000Z'),
  trialEndsAt: d('2026-11-09T00:00:00.000Z'),
  trialEndedEarlyAt: null,
  periods: [],
  stripe: null,
};
const projects = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, createdAt: d('2026-10-11T00:00:00Z'), archivedAt: null }));

/** Respuestas de Stripe por ruta. */
function stripeAnswers(extra: Record<string, unknown> = {}) {
  vi.mocked(stripeRequest).mockImplementation(async (_method, path) => {
    if (path === '/prices') {
      return {
        data: [
          { id: 'price_base', lookup_key: 'luma_base_monthly' },
          { id: 'price_extra', lookup_key: 'luma_extra_project_monthly' },
        ],
      } as never;
    }
    if (path === '/customers') return { id: 'cus_1' } as never;
    if (path === '/checkout/sessions') return { url: 'https://checkout.stripe.test/s' } as never;
    if (path in extra) return extra[path] as never;
    throw new Error(`ruta inesperada ${path}`);
  });
}

function checkoutParams() {
  const call = vi.mocked(stripeRequest).mock.calls.find(([, path]) => path === '/checkout/sessions');
  return call![2] as Record<string, any>;
}

beforeEach(() => {
  vi.clearAllMocks();
  svc.resetPriceCache();
  vi.mocked(loadFacts).mockResolvedValue(trial);
  vi.mocked(billableProjects).mockResolvedValue(projects(2));
  vi.mocked(Subscription.findOne).mockResolvedValue({
    organization: 'org-1',
    stripeCustomerId: null,
    stripeStatus: null,
  } as never);
  stripeAnswers();
});

describe('createCheckoutSession', () => {
  it('en prueba: Stripe espera al fin de la prueba para cobrar (no pierde días)', async () => {
    const { url } = await svc.createCheckoutSession({
      organizationId: 'org-1',
      userId: 'user-1',
      activateNow: false,
      now: NOW,
    });

    expect(url).toBe('https://checkout.stripe.test/s');
    const params = checkoutParams();
    expect(params.mode).toBe('subscription');
    expect(params.customer).toBe('cus_1');
    expect(params.line_items).toEqual([{ price: 'price_base', quantity: 1 }]);
    expect(params.subscription_data.trial_end).toBe(sec('2026-11-09T00:00:00.000Z'));
    expect(params.success_url).toBe('https://luma.test/app/admin/settings/subscription?stripe=ok');
    // El cliente nuevo queda guardado.
    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1', stripeCustomerId: null },
      { $set: { stripeCustomerId: 'cus_1' } },
    );
  });

  it('pasar a Pro ya con 3 obras: cobra hoy sólo el plan, sin esperar a la prueba', async () => {
    vi.mocked(billableProjects).mockResolvedValue(projects(3));

    await svc.createCheckoutSession({ organizationId: 'org-1', userId: 'user-1', activateNow: true, now: NOW });

    const params = checkoutParams();
    expect(params.line_items).toEqual([{ price: 'price_base', quantity: 1 }]);
    expect(params.subscription_data.trial_end).toBeUndefined();
  });

  it('pasar a Pro para crear la cuarta: cobra hoy base + la cuarta', async () => {
    vi.mocked(billableProjects).mockResolvedValue(projects(3));

    await svc.createCheckoutSession({
      organizationId: 'org-1',
      userId: 'user-1',
      activateNow: true,
      includeNextProject: true,
      now: NOW,
    });

    const params = checkoutParams();
    expect(params.line_items).toEqual([
      { price: 'price_base', quantity: 1 },
      { price: 'price_extra', quantity: 1 },
    ]);
    expect(params.subscription_data.trial_end).toBeUndefined();
    expect(params.subscription_data.metadata).toEqual({ organizationId: 'org-1', activateNow: 'true' });
  });

  it('a menos de 48 horas del fin de la prueba no se puede diferir: arranca hoy', async () => {
    await svc.createCheckoutSession({
      organizationId: 'org-1',
      userId: 'user-1',
      activateNow: false,
      now: d('2026-11-08T00:00:00.000Z'),
    });
    expect(checkoutParams().subscription_data.trial_end).toBeUndefined();
  });

  it('con la tarjeta ya activa no abre otro checkout', async () => {
    vi.mocked(Subscription.findOne).mockResolvedValue({ stripeStatus: 'active' } as never);
    await expect(
      svc.createCheckoutSession({ organizationId: 'org-1', userId: 'user-1', activateNow: false, now: NOW }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('reusa el cliente de Stripe si ya existe', async () => {
    vi.mocked(Subscription.findOne).mockResolvedValue({ stripeCustomerId: 'cus_viejo', stripeStatus: 'canceled' } as never);
    await svc.createCheckoutSession({ organizationId: 'org-1', userId: 'user-1', activateNow: false, now: NOW });
    expect(checkoutParams().customer).toBe('cus_viejo');
    expect(vi.mocked(stripeRequest).mock.calls.some(([, path]) => path === '/customers')).toBe(false);
  });
});

const stripeSub = (extra: Record<string, unknown> = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  metadata: { organizationId: 'org-1', activateNow: 'false' },
  items: {
    data: [
      {
        id: 'si_base',
        quantity: 1,
        price: { id: 'price_base' },
        current_period_start: sec('2026-11-09T00:00:00Z'),
        current_period_end: sec('2026-12-09T00:00:00Z'),
      },
    ],
  },
  ...extra,
});

describe('syncSubscriptionFromStripe', () => {
  it('guarda estado y período (leído de los ítems, API 2025-03-31)', async () => {
    await svc.syncSubscriptionFromStripe(stripeSub() as never);
    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1' },
      {
        $set: {
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          stripeStatus: 'active',
          stripeCurrentPeriodStart: d('2026-11-09T00:00:00Z'),
          stripeCurrentPeriodEnd: d('2026-12-09T00:00:00Z'),
        },
      },
    );
  });

  it('activar ya: corta la prueba cuando arranca el período pago, una sola vez', async () => {
    await svc.syncSubscriptionFromStripe(
      stripeSub({ metadata: { organizationId: 'org-1', activateNow: 'true' } }) as never,
    );
    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1', trialEndedEarlyAt: null, trialEndsAt: { $gt: d('2026-11-09T00:00:00Z') } },
      { $set: { trialEndedEarlyAt: d('2026-11-09T00:00:00Z') } },
    );
  });
});

describe('recordPaidInvoice', () => {
  const invoice = (extra: Record<string, unknown> = {}) => ({
    id: 'in_1',
    customer: 'cus_1',
    currency: 'usd',
    amount_paid: 5100,
    status_transitions: { paid_at: sec('2026-11-09T00:05:00Z') },
    parent: { subscription_details: { metadata: { organizationId: 'org-1' } } },
    lines: {
      data: [
        { amount: 3900, quantity: 1, pricing: { price_details: { price: 'price_base' } }, period: { start: sec('2026-11-09T00:00:00Z'), end: sec('2026-12-09T00:00:00Z') } },
        { amount: 800, quantity: 1, pricing: { price_details: { price: 'price_extra' } }, period: { start: sec('2026-11-09T00:00:00Z'), end: sec('2026-12-09T00:00:00Z') } },
        // Así prorratea Stripe un 1 → 2: crédito por la cantidad vieja, cargo por la nueva.
        { amount: -400, quantity: 1, parent: { subscription_item_details: { proration: true } }, pricing: { price_details: { price: 'price_extra' } }, period: { start: sec('2026-10-25T00:00:00Z'), end: sec('2026-11-09T00:00:00Z') } },
        { amount: 800, quantity: 2, parent: { subscription_item_details: { proration: true } }, pricing: { price_details: { price: 'price_extra' } }, period: { start: sec('2026-10-25T00:00:00Z'), end: sec('2026-11-09T00:00:00Z') } },
      ],
    },
    ...extra,
  });

  it('registra la factura como pago aprobado, con base, extra y prorrateo, y el período del mes pagado', async () => {
    await svc.recordPaidInvoice(invoice() as never);

    const [filter, update, options] = vi.mocked(SubscriptionPayment.updateOne).mock.calls[0]!;
    expect(filter).toEqual({ stripeInvoiceId: 'in_1' });
    expect(options).toEqual({ upsert: true });
    expect((update as any).$setOnInsert).toMatchObject({
      organization: 'org-1',
      method: 'stripe',
      status: 'aprobado',
      totalUsd: 51,
      periodStart: d('2026-11-09T00:00:00Z'),
      periodEnd: d('2026-12-09T00:00:00Z'),
    });
    const lines = (update as any).$setOnInsert.lines;
    expect(lines.map((l: any) => l.kind)).toEqual(['base', 'extra', 'prorrateo']);
    // El crédito y el cargo del prorrateo quedan como una línea neta: −4 + 8 = 4.
    expect(lines[2].amountUsd).toBe(4);
  });

  it('una factura suelta de prorrateos se registra igual, con el período de los prorrateos', async () => {
    const onlyProration = invoice({
      amount_paid: 400,
      parent: null,
      lines: { data: invoice().lines.data.slice(2) },
    });
    vi.mocked(Subscription.findOne).mockReturnValue({
      select: () => Promise.resolve({ organization: 'org-1' }),
    } as never);

    await svc.recordPaidInvoice(onlyProration as never);

    const [, update] = vi.mocked(SubscriptionPayment.updateOne).mock.calls[0]!;
    expect((update as any).$setOnInsert).toMatchObject({
      organization: 'org-1',
      totalUsd: 4,
      periodStart: d('2026-10-25T00:00:00Z'),
      periodEnd: d('2026-11-09T00:00:00Z'),
    });
  });

  it('la factura de $0 de una prueba no se registra', async () => {
    await svc.recordPaidInvoice(invoice({ amount_paid: 0 }) as never);
    expect(SubscriptionPayment.updateOne).not.toHaveBeenCalled();
  });
});

describe('handleStripeEvent', () => {
  it('un evento repetido no se procesa dos veces', async () => {
    vi.mocked(StripeEvent.create).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const processed = await svc.handleStripeEvent({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } });
    expect(processed).toBe(false);
    expect(SubscriptionPayment.updateOne).not.toHaveBeenCalled();
  });

  it('si el procesamiento falla, borra la marca para que el reintento de Stripe lo haga', async () => {
    vi.mocked(StripeEvent.create).mockResolvedValue({} as never);
    vi.mocked(Subscription.updateOne).mockRejectedValue(new Error('mongo caído'));
    await expect(
      svc.handleStripeEvent({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: stripeSub() } }),
    ).rejects.toThrow('mongo caído');
    expect(StripeEvent.deleteOne).toHaveBeenCalledWith({ eventId: 'evt_2' });
  });

  it('checkout.session.completed trae la suscripción de Stripe y la sincroniza', async () => {
    vi.mocked(StripeEvent.create).mockResolvedValue({} as never);
    vi.mocked(Subscription.updateOne).mockResolvedValue({} as never);
    stripeAnswers({ '/subscriptions/sub_1': stripeSub() });

    await svc.handleStripeEvent({ id: 'evt_3', type: 'checkout.session.completed', data: { object: { subscription: 'sub_1' } } });

    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1' },
      expect.objectContaining({ $set: expect.objectContaining({ stripeStatus: 'active' }) }),
    );
  });
});

describe('invoice.payment_failed', () => {
  const failed = (attempt_count: number) => ({
    id: `evt_fail_${attempt_count}`,
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: 'in_9',
        customer: 'cus_1',
        attempt_count,
        parent: { subscription_details: { metadata: { organizationId: 'org-1' } } },
      },
    },
  });

  beforeEach(() => vi.mocked(StripeEvent.create).mockResolvedValue({} as never));

  it('avisa al dueño en el primer intento fallido', async () => {
    await svc.handleStripeEvent(failed(1));
    expect(notifyCardPaymentFailed).toHaveBeenCalledWith('org-1');
  });

  it('no repite el aviso en cada reintento de Stripe', async () => {
    vi.mocked(notifyCardPaymentFailed).mockClear();
    await svc.handleStripeEvent(failed(2));
    expect(notifyCardPaymentFailed).not.toHaveBeenCalled();
  });
});

describe('syncStripeExtras', () => {
  beforeEach(() => {
    vi.mocked(Subscription.findOne).mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      stripeStatus: 'active',
    } as never);
  });

  it('una cuarta obra agrega el ítem extra prorrateando el resto del mes', async () => {
    vi.mocked(billableProjects).mockResolvedValue(projects(4));
    stripeAnswers({ '/subscriptions/sub_1': stripeSub(), '/subscription_items': {} });

    await svc.syncStripeExtras('org-1', NOW);

    expect(stripeRequest).toHaveBeenCalledWith('POST', '/subscription_items', {
      subscription: 'sub_1',
      price: 'price_extra',
      quantity: 1,
      proration_behavior: 'create_prorations',
    });
  });

  it('con menos obras baja la cantidad sin devolver nada', async () => {
    vi.mocked(billableProjects).mockResolvedValue(projects(4));
    const sub = stripeSub();
    sub.items.data.push({ id: 'si_extra', quantity: 2, price: { id: 'price_extra' } } as never);
    stripeAnswers({ '/subscriptions/sub_1': sub, '/subscription_items/si_extra': {} });

    await svc.syncStripeExtras('org-1', NOW);

    expect(stripeRequest).toHaveBeenCalledWith('POST', '/subscription_items/si_extra', {
      quantity: 1,
      proration_behavior: 'none',
    });
  });

  it('si ya coincide no toca nada', async () => {
    vi.mocked(billableProjects).mockResolvedValue(projects(3));
    stripeAnswers({ '/subscriptions/sub_1': stripeSub() });
    await svc.syncStripeExtras('org-1', NOW);
    expect(vi.mocked(stripeRequest).mock.calls.filter(([m]) => m !== 'GET')).toHaveLength(0);
  });
});
