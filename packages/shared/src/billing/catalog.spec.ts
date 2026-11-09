import { describe, expect, it } from 'vitest';
import { binancePaymentSchema, planConfigSchema } from '../schemas/subscription';
import { subscriptionReceiptExtension } from '../types/subscription';
import {
  DEFAULT_PLAN_CONFIG,
  LEGACY_PLAN_CONFIG,
  canCreateProject,
  extraTierRanges,
  extraUnitPrice,
  planToSwitchTo,
  pricingFor,
  quoteCharge,
  renewingPlan,
  subscriptionOffer,
  subscriptionState,
  type BillableProject,
  type PaidPeriodFact,
  type SubscriptionFacts,
} from './index';

const d = (iso: string) => new Date(iso);
const START = d('2026-06-01T00:00:00Z');

function projects(count: number): BillableProject[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${String(index).padStart(3, '0')}`,
    createdAt: d('2026-01-01T00:00:00Z'),
    archivedAt: null,
  }));
}

function quote(count: number, plan?: 'pro' | 'unlimited') {
  return quoteCharge({
    periodStart: START,
    projects: projects(count),
    config: DEFAULT_PLAN_CONFIG,
    plan,
    previousPeriod: null,
  });
}

function period(overrides: Partial<PaidPeriodFact>): PaidPeriodFact {
  return {
    start: d('2026-05-01T00:00:00Z'),
    end: d('2026-06-01T00:00:00Z'),
    status: 'aprobado',
    submittedAt: d('2026-05-01T00:00:00Z'),
    ...overrides,
  };
}

const facts = (periods: PaidPeriodFact[]): SubscriptionFacts => ({
  trialStartedAt: d('2026-03-01T00:00:00Z'),
  trialEndsAt: d('2026-03-31T00:00:00Z'),
  periods,
});

describe('catálogo: escalones', () => {
  it('cobra cada obra extra al precio de su escalón', () => {
    const { lines, totalUsd } = quote(12);
    expect(lines.filter((line) => line.kind === 'extra')).toEqual([
      { kind: 'extra', quantity: 7, unitUsd: 8, amountUsd: 56 },
      { kind: 'extra', quantity: 2, unitUsd: 6, amountUsd: 12 },
    ]);
    expect(totalUsd).toBe(107);
  });

  it('llega al último escalón', () => {
    expect(quote(30).totalUsd).toBe(39 + 7 * 8 + 15 * 6 + 5 * 4);
  });

  it('dentro de lo incluido no hay extras', () => {
    expect(quote(3).lines).toHaveLength(1);
    expect(quote(3).totalUsd).toBe(39);
  });

  it('sumar una obra nunca baja la factura', () => {
    for (let count = 1; count < 60; count += 1) {
      expect(quote(count + 1).totalUsd).toBeGreaterThanOrEqual(quote(count).totalUsd);
    }
  });

  it('la obra número N cae en su escalón, bordes incluidos', () => {
    expect(extraUnitPrice(DEFAULT_PLAN_CONFIG, 4)).toBe(8);
    expect(extraUnitPrice(DEFAULT_PLAN_CONFIG, 10)).toBe(8);
    expect(extraUnitPrice(DEFAULT_PLAN_CONFIG, 11)).toBe(6);
    expect(extraUnitPrice(DEFAULT_PLAN_CONFIG, 26)).toBe(4);
  });

  it('sin lista explícita cobra lo de antes del catálogo', () => {
    const { totalUsd } = quoteCharge({ periodStart: START, projects: projects(12), previousPeriod: null });
    expect(totalUsd).toBe(39 + 9 * 8);
  });
});

describe('catálogo: plan Ilimitado', () => {
  it('es un precio fijo, sin extras', () => {
    const { lines, totalUsd } = quote(40, 'unlimited');
    expect(lines).toEqual([{ kind: 'unlimited', quantity: 1, unitUsd: 149, amountUsd: 149 }]);
    expect(totalUsd).toBe(149);
  });

  it('una lista que no lo ofrece no lo cotiza', () => {
    expect(() =>
      quoteCharge({
        periodStart: START,
        projects: projects(1),
        config: LEGACY_PLAN_CONFIG,
        plan: 'unlimited',
      }),
    ).toThrow();
  });

  it('con el plan vigente ninguna obra es extra', () => {
    const state = subscriptionState(
      facts([period({ plan: 'unlimited', end: d('2026-07-01T00:00:00Z') })]),
      d('2026-06-15T00:00:00Z'),
    );
    expect(state.plan).toBe('unlimited');
    expect(canCreateProject(state, 50, DEFAULT_PLAN_CONFIG)).toEqual({
      allowed: true,
      startsTrial: false,
      isExtra: false,
    });
  });

  it('un período Ilimitado no deja prorrateos para el siguiente', () => {
    const created = { id: 'nueva', createdAt: d('2026-05-20T00:00:00Z'), archivedAt: null };
    const { lines } = quoteCharge({
      periodStart: START,
      projects: [...projects(3), created],
      config: DEFAULT_PLAN_CONFIG,
      previousPeriod: {
        start: d('2026-05-01T00:00:00Z'),
        end: START,
        prepaidExtras: 0,
        plan: 'unlimited',
      },
    });
    expect(lines.some((line) => line.kind === 'prorrateo')).toBe(false);
  });
});

describe('catálogo: prorrateo', () => {
  it('lo creado en un período se cobra a los precios de ese período', () => {
    const created = { id: 'nueva', createdAt: d('2026-05-16T00:00:00Z'), archivedAt: null };
    const { lines } = quoteCharge({
      periodStart: START,
      projects: [...projects(3), created],
      config: { ...DEFAULT_PLAN_CONFIG, extraTiers: [{ upToProjects: null, unitUsd: 100 }] },
      previousPeriod: {
        start: d('2026-05-01T00:00:00Z'),
        end: START,
        prepaidExtras: 0,
        config: DEFAULT_PLAN_CONFIG,
      },
    });
    const prorated = lines.find((line) => line.kind === 'prorrateo');
    expect(prorated?.unitUsd).toBe(8);
  });
});

describe('pricingFor', () => {
  const inPeriod = d('2026-05-20T00:00:00Z');

  it('quien nunca pagó entra a la lista vigente', () => {
    expect(pricingFor(facts([]), inPeriod)).toEqual({ plan: 'pro', version: 'current' });
  });

  it('quien ya paga mantiene su lista y su plan', () => {
    expect(pricingFor(facts([period({ planVersion: 2, plan: 'unlimited' })]), inPeriod)).toEqual({
      plan: 'unlimited',
      version: 2,
    });
  });

  it('un pago de antes del catálogo sigue con lo de antes', () => {
    expect(pricingFor(facts([period({})]), inPeriod)).toEqual({ plan: 'pro', version: null });
  });

  it('renovar dentro de la gracia no corta la continuidad', () => {
    expect(pricingFor(facts([period({ planVersion: 2 })]), d('2026-06-03T00:00:00Z')).version).toBe(2);
  });

  it('quien corta la continuidad entra a la vigente', () => {
    expect(pricingFor(facts([period({ planVersion: 2 })]), d('2026-06-10T00:00:00Z')).version).toBe(
      'current',
    );
  });

  it('cambiar de plan toma la lista vigente', () => {
    expect(pricingFor(facts([period({ planVersion: 2 })]), inPeriod, 'unlimited')).toEqual({
      plan: 'unlimited',
      version: 'current',
    });
  });

  it('un pago rechazado o pendiente no cuenta', () => {
    expect(
      pricingFor(
        facts([period({ status: 'rechazado', planVersion: 2 }), period({ status: 'pendiente', planVersion: 2 })]),
        inPeriod,
      ).version,
    ).toBe('current');
  });
});

describe('renewingPlan', () => {
  it('quien nunca pagó no renueva nada', () => {
    expect(renewingPlan(facts([]), d('2026-05-20T00:00:00Z'))).toBeNull();
  });

  it('dentro de la gracia renueva lo último que pagó, aunque ya no lo cubra', () => {
    expect(renewingPlan(facts([period({ plan: 'unlimited' })]), d('2026-06-02T00:00:00Z'))).toBe('unlimited');
  });

  it('pasada la gracia ya no renueva', () => {
    expect(renewingPlan(facts([period({ plan: 'unlimited' })]), d('2026-06-10T00:00:00Z'))).toBeNull();
  });

  it('una tarjeta viva renueva Pro aunque Stripe no haya cobrado', () => {
    const stripe = { currentPeriodStart: START, currentPeriodEnd: START };
    expect(renewingPlan({ ...facts([]), stripe: { ...stripe, status: 'trialing' } }, START)).toBe('pro');
    expect(renewingPlan({ ...facts([]), stripe: { ...stripe, status: 'canceled' } }, START)).toBeNull();
  });
});

describe('planToSwitchTo', () => {
  it('sólo hay cambio si ya hay un plan que renovar y el otro existe', () => {
    expect(planToSwitchTo('pro', DEFAULT_PLAN_CONFIG)).toBe('unlimited');
    expect(planToSwitchTo('unlimited', DEFAULT_PLAN_CONFIG)).toBe('pro');
    expect(planToSwitchTo('pro', LEGACY_PLAN_CONFIG)).toBeNull();
    expect(planToSwitchTo(null, DEFAULT_PLAN_CONFIG)).toBeNull();
  });
});

describe('subscriptionOffer', () => {
  it('quien renueva Ilimitado ve su precio aunque el catálogo haya cambiado', () => {
    const offer = subscriptionOffer({
      config: DEFAULT_PLAN_CONFIG,
      catalog: { ...DEFAULT_PLAN_CONFIG, unlimitedPriceUsd: 199 },
      projects: [],
      state: { status: 'vencida', canWrite: false, accessUntil: null, trialDaysLeft: null },
      renewing: 'unlimited',
      switchTotalUsd: 39,
      now: START,
    });
    expect(offer.unlimitedUsd).toBe(149);
    expect(offer.switchTotalUsd).toBe(39);
  });
});

describe('extraTierRanges', () => {
  it('arma los rangos desde la primera obra extra', () => {
    expect(extraTierRanges(DEFAULT_PLAN_CONFIG)).toEqual([
      { from: 4, to: 10, unitUsd: 8 },
      { from: 11, to: 25, unitUsd: 6 },
      { from: 26, to: null, unitUsd: 4 },
    ]);
  });
});

describe('subscriptionReceiptExtension', () => {
  it('acepta sólo los tipos propios, no lo heredado de Object', () => {
    expect(subscriptionReceiptExtension('application/pdf')).toBe('.pdf');
    expect(subscriptionReceiptExtension('constructor')).toBeUndefined();
    expect(subscriptionReceiptExtension('__proto__')).toBeUndefined();
  });
});

describe('binancePaymentSchema', () => {
  const valid = {
    orderId: '298765432109876',
    payerBinanceId: '35123456',
    paidOn: '2026-11-09',
    amountUsdt: '39',
    activateNow: 'false',
    includeNextProject: 'false',
  };

  it('acepta lo que llega por multipart, como strings', () => {
    const parsed = binancePaymentSchema.parse(valid);
    expect(parsed.amountUsdt).toBe(39);
    expect(parsed.activateNow).toBe(false);
  });

  it('alcanza con el plan: lo demás sale del propio cobro', () => {
    expect(
      binancePaymentSchema.safeParse({ activateNow: 'false', includeNextProject: 'false' }).success,
    ).toBe(true);
  });

  it('la orden y el ID, si vienen, son sólo números', () => {
    expect(binancePaymentSchema.safeParse({ ...valid, orderId: 'abc123' }).success).toBe(false);
    expect(binancePaymentSchema.safeParse({ ...valid, payerBinanceId: 'juan' }).success).toBe(false);
  });
});

describe('planConfigSchema', () => {
  const tiers = (extraTiers: typeof DEFAULT_PLAN_CONFIG.extraTiers) =>
    planConfigSchema.safeParse({ ...DEFAULT_PLAN_CONFIG, extraTiers }).success;

  it('acepta la lista de fábrica', () => {
    expect(planConfigSchema.safeParse(DEFAULT_PLAN_CONFIG).success).toBe(true);
  });

  it('el último escalón va sin tope, y sólo ése', () => {
    expect(tiers([{ upToProjects: 10, unitUsd: 8 }])).toBe(false);
    expect(
      tiers([
        { upToProjects: null, unitUsd: 8 },
        { upToProjects: null, unitUsd: 6 },
      ]),
    ).toBe(false);
  });

  it('los escalones suben de obra y no suben de precio', () => {
    expect(
      tiers([
        { upToProjects: 10, unitUsd: 8 },
        { upToProjects: 10, unitUsd: 6 },
        { upToProjects: null, unitUsd: 4 },
      ]),
    ).toBe(false);
    expect(
      tiers([
        { upToProjects: 10, unitUsd: 6 },
        { upToProjects: null, unitUsd: 8 },
      ]),
    ).toBe(false);
  });

  it('un escalón no puede terminar dentro de lo incluido', () => {
    expect(
      tiers([
        { upToProjects: 2, unitUsd: 8 },
        { upToProjects: null, unitUsd: 4 },
      ]),
    ).toBe(false);
  });

  it('los precios llevan hasta dos decimales', () => {
    expect(planConfigSchema.safeParse({ ...DEFAULT_PLAN_CONFIG, basePriceUsd: 39.99 }).success).toBe(true);
    expect(planConfigSchema.safeParse({ ...DEFAULT_PLAN_CONFIG, basePriceUsd: 39.999 }).success).toBe(false);
  });
});
