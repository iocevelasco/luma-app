import { describe, expect, it } from 'vitest';
import {
  PLAN,
  activeProjectsAt,
  addMonths,
  canCreateProject,
  isPlausibleRate,
  nextPeriodStart,
  quoteCharge,
  startTrial,
  subscriptionState,
  usdToBolivares,
  type BillableProject,
  type SubscriptionFacts,
} from './index';

const d = (iso: string) => new Date(iso);

function trialFacts(startIso: string, extra: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  const { trialStartedAt, trialEndsAt } = startTrial(d(startIso));
  return { trialStartedAt, trialEndsAt, periods: [], stripe: null, ...extra };
}

function project(id: string, createdIso: string, archivedIso?: string): BillableProject {
  return { id, createdAt: d(createdIso), archivedAt: archivedIso ? d(archivedIso) : null };
}

describe('addMonths', () => {
  it('suma un mes de calendario', () => {
    expect(addMonths(d('2026-03-15T10:00:00Z'), 1).toISOString()).toBe('2026-04-15T10:00:00.000Z');
  });

  it('el 31 de enero cae en el último día de febrero, no en marzo', () => {
    expect(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addMonths(d('2028-01-31T00:00:00Z'), 1).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('cruza el año', () => {
    expect(addMonths(d('2026-12-10T00:00:00Z'), 1).toISOString()).toBe('2027-01-10T00:00:00.000Z');
  });
});

describe('subscriptionState', () => {
  it('sin prueba ni pagos: sin_iniciar, y puede escribir (su primera obra le arranca la prueba)', () => {
    const state = subscriptionState(
      { trialStartedAt: null, trialEndsAt: null, periods: [] },
      d('2026-10-01T00:00:00Z'),
    );
    expect(state.status).toBe('sin_iniciar');
    expect(state.canWrite).toBe(true);
  });

  it('dentro de los 30 días: prueba, con los días que quedan', () => {
    const state = subscriptionState(trialFacts('2026-10-01T00:00:00Z'), d('2026-10-21T00:00:00Z'));
    expect(state.status).toBe('prueba');
    expect(state.trialDaysLeft).toBe(10);
    expect(state.canWrite).toBe(true);
  });

  it('pasada la prueba sin pagar: vencida y sólo lectura', () => {
    const state = subscriptionState(trialFacts('2026-10-01T00:00:00Z'), d('2026-11-01T00:00:00Z'));
    expect(state.status).toBe('vencida');
    expect(state.canWrite).toBe(false);
  });

  it('pagar por adelantado no corta la prueba: sigue en prueba y el acceso llega hasta el fin del período pago', () => {
    const facts = trialFacts('2026-10-01T00:00:00Z', {
      periods: [
        {
          start: d('2026-10-31T00:00:00Z'),
          end: d('2026-11-30T00:00:00Z'),
          status: 'aprobado',
          submittedAt: d('2026-10-20T00:00:00Z'),
        },
      ],
    });
    const during = subscriptionState(facts, d('2026-10-25T00:00:00Z'));
    expect(during.status).toBe('prueba');
    expect(during.accessUntil?.toISOString()).toBe('2026-11-30T00:00:00.000Z');

    expect(subscriptionState(facts, d('2026-11-10T00:00:00Z')).status).toBe('activa');
  });

  it('un pago anticipado arranca cuando termina la prueba, no hoy (regla 3)', () => {
    const facts = trialFacts('2026-10-01T00:00:00Z');
    expect(nextPeriodStart(facts, d('2026-10-20T00:00:00Z')).toISOString()).toBe(
      '2026-10-31T00:00:00.000Z',
    );
  });

  it('cortar la prueba para crear la cuarta obra termina la prueba ese día (regla 4)', () => {
    const facts = trialFacts('2026-10-01T00:00:00Z', {
      trialEndedEarlyAt: d('2026-10-10T00:00:00Z'),
    });
    expect(subscriptionState(facts, d('2026-10-12T00:00:00Z')).status).toBe('vencida');
    expect(nextPeriodStart(facts, d('2026-10-10T00:00:00Z')).toISOString()).toBe(
      '2026-10-10T00:00:00.000Z',
    );
  });

  it('un pago en Bs pendiente da 72 horas de acceso completo', () => {
    const facts = trialFacts('2026-09-01T00:00:00Z', {
      periods: [
        {
          start: d('2026-10-01T00:00:00Z'),
          end: d('2026-11-01T00:00:00Z'),
          status: 'pendiente',
          submittedAt: d('2026-10-02T12:00:00Z'),
        },
      ],
    });
    const inGrace = subscriptionState(facts, d('2026-10-04T12:00:00Z'));
    expect(inGrace.status).toBe('en_revision');
    expect(inGrace.canWrite).toBe(true);

    expect(subscriptionState(facts, d('2026-10-05T12:00:01Z')).status).toBe('vencida');
  });

  it('un pago rechazado no cubre nada', () => {
    const facts = trialFacts('2026-09-01T00:00:00Z', {
      periods: [
        {
          start: d('2026-10-01T00:00:00Z'),
          end: d('2026-11-01T00:00:00Z'),
          status: 'rechazado',
          submittedAt: d('2026-10-01T00:00:00Z'),
        },
      ],
    });
    expect(subscriptionState(facts, d('2026-10-10T00:00:00Z')).status).toBe('vencida');
  });

  it('Stripe activo cubre su período', () => {
    const facts = trialFacts('2026-09-01T00:00:00Z', {
      stripe: {
        status: 'active',
        currentPeriodStart: d('2026-10-01T00:00:00Z'),
        currentPeriodEnd: d('2026-11-01T00:00:00Z'),
      },
    });
    expect(subscriptionState(facts, d('2026-10-15T00:00:00Z')).status).toBe('activa');
  });

  it('Stripe en past_due tiene la misma gracia de 72 horas', () => {
    const facts = trialFacts('2026-09-01T00:00:00Z', {
      stripe: {
        status: 'past_due',
        currentPeriodStart: d('2026-10-01T00:00:00Z'),
        currentPeriodEnd: d('2026-11-01T00:00:00Z'),
      },
    });
    expect(subscriptionState(facts, d('2026-10-02T00:00:00Z')).status).toBe('pago_fallido');
    expect(subscriptionState(facts, d('2026-10-05T00:00:00Z')).status).toBe('vencida');
  });

  it('Stripe trialing durante nuestra prueba sigue siendo prueba', () => {
    const facts = trialFacts('2026-10-01T00:00:00Z', {
      stripe: {
        status: 'trialing',
        currentPeriodStart: d('2026-10-05T00:00:00Z'),
        currentPeriodEnd: d('2026-10-31T00:00:00Z'),
      },
    });
    expect(subscriptionState(facts, d('2026-10-10T00:00:00Z')).status).toBe('prueba');
  });
});

describe('canCreateProject', () => {
  const now = d('2026-10-10T00:00:00Z');

  it('la primera obra de un invitado le arranca la prueba', () => {
    const state = subscriptionState({ trialStartedAt: null, trialEndsAt: null, periods: [] }, now);
    expect(canCreateProject(state, 0)).toEqual({ allowed: true, startsTrial: true, isExtra: false });
  });

  it('en prueba, hasta 3 sí; la cuarta pide activar el plan', () => {
    const state = subscriptionState(trialFacts('2026-10-01T00:00:00Z'), now);
    expect(canCreateProject(state, 2)).toMatchObject({ allowed: true, isExtra: false });
    expect(canCreateProject(state, 3)).toEqual({ allowed: false, code: 'PAID_PLAN_REQUIRED' });
  });

  it('con plan, la cuarta se puede y es extra', () => {
    const state = subscriptionState(
      trialFacts('2026-08-01T00:00:00Z', {
        periods: [
          {
            start: d('2026-10-01T00:00:00Z'),
            end: d('2026-11-01T00:00:00Z'),
            status: 'aprobado',
            submittedAt: d('2026-10-01T00:00:00Z'),
          },
        ],
      }),
      now,
    );
    expect(canCreateProject(state, 3)).toEqual({ allowed: true, startsTrial: false, isExtra: true });
  });

  it('vencida no crea nada', () => {
    const state = subscriptionState(trialFacts('2026-08-01T00:00:00Z'), now);
    expect(canCreateProject(state, 0)).toEqual({ allowed: false, code: 'SUBSCRIPTION_REQUIRED' });
  });
});

describe('quoteCharge', () => {
  const start = d('2026-11-01T00:00:00Z');

  it('con 3 obras o menos, sólo el plan base', () => {
    const quote = quoteCharge({
      periodStart: start,
      projects: [project('a', '2026-01-01T00:00:00Z'), project('b', '2026-01-02T00:00:00Z')],
    });
    expect(quote.totalUsd).toBe(PLAN.basePriceUsd);
    expect(quote.periodEnd).toBe('2026-12-01T00:00:00.000Z');
  });

  it('5 obras activas: $39 + 2 × $8 = $55', () => {
    const projects = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      project(id, `2026-01-0${i + 1}T00:00:00Z`),
    );
    const quote = quoteCharge({ periodStart: start, projects });
    expect(quote.lines).toContainEqual({ kind: 'extra', quantity: 2, unitUsd: 8, amountUsd: 16 });
    expect(quote.totalUsd).toBe(55);
  });

  it('las archivadas no cuentan para el período que arranca', () => {
    const projects = [
      project('a', '2026-01-01T00:00:00Z'),
      project('b', '2026-01-02T00:00:00Z'),
      project('c', '2026-01-03T00:00:00Z'),
      project('d', '2026-01-04T00:00:00Z', '2026-10-15T00:00:00Z'),
    ];
    expect(quoteCharge({ periodStart: start, projects }).totalUsd).toBe(39);
  });

  it('una extra creada a mitad del período anterior se prorratea por los días que le quedaban', () => {
    // Período anterior: 1 al 31 de octubre (31 días). La cuarta se crea el 16:
    // le quedan 16 días → 8 × 16/31 = 4,13.
    const previousPeriod = { start: d('2026-10-01T00:00:00Z'), end: d('2026-11-01T00:00:00Z') };
    const projects = [
      project('a', '2026-01-01T00:00:00Z'),
      project('b', '2026-01-02T00:00:00Z'),
      project('c', '2026-01-03T00:00:00Z'),
      project('d', '2026-10-16T00:00:00Z'),
    ];
    const quote = quoteCharge({ periodStart: start, projects, previousPeriod });

    expect(quote.lines).toContainEqual({
      kind: 'prorrateo',
      quantity: 1,
      unitUsd: 8,
      amountUsd: 4.13,
      projectId: 'd',
      days: 16,
    });
    // Base + la extra del mes nuevo por adelantado + el prorrateo.
    expect(quote.totalUsd).toBeCloseTo(51.13, 2);
  });

  it('archivar no devuelve días: una extra creada y archivada en el mismo período igual paga su prorrateo', () => {
    const previousPeriod = { start: d('2026-10-01T00:00:00Z'), end: d('2026-11-01T00:00:00Z') };
    const projects = [
      project('a', '2026-01-01T00:00:00Z'),
      project('b', '2026-01-02T00:00:00Z'),
      project('c', '2026-01-03T00:00:00Z'),
      project('d', '2026-10-16T00:00:00Z', '2026-10-20T00:00:00Z'),
    ];
    const quote = quoteCharge({ periodStart: start, projects, previousPeriod });
    expect(quote.lines.map((l) => l.kind)).toEqual(['base', 'prorrateo']);
  });

  it('una obra creada a mitad de período dentro de las 3 incluidas no paga nada', () => {
    const previousPeriod = { start: d('2026-10-01T00:00:00Z'), end: d('2026-11-01T00:00:00Z') };
    const projects = [project('a', '2026-01-01T00:00:00Z'), project('b', '2026-10-16T00:00:00Z')];
    expect(quoteCharge({ periodStart: start, projects, previousPeriod }).totalUsd).toBe(39);
  });

  it('al salir de la prueba arrancan juntos plan y extra, mes completo y sin prorrateo (regla 4)', () => {
    const activation = d('2026-10-10T00:00:00Z');
    const projects = [
      project('a', '2026-10-01T00:00:00Z'),
      project('b', '2026-10-02T00:00:00Z'),
      project('c', '2026-10-03T00:00:00Z'),
      // La cuarta, que se crea en el mismo instante en que arranca el plan.
      project('d', '2026-10-10T00:00:00Z'),
    ];
    const quote = quoteCharge({ periodStart: activation, projects, previousPeriod: null });
    expect(quote.totalUsd).toBe(47);
    expect(quote.lines.some((l) => l.kind === 'prorrateo')).toBe(false);
  });
});

describe('activeProjectsAt', () => {
  it('cuenta las creadas hasta ese momento y no archivadas todavía', () => {
    const projects = [
      project('a', '2026-01-01T00:00:00Z'),
      project('b', '2026-05-01T00:00:00Z', '2026-06-01T00:00:00Z'),
      project('c', '2026-07-01T00:00:00Z'),
    ];
    expect(activeProjectsAt(projects, d('2026-05-15T00:00:00Z'))).toBe(2);
    expect(activeProjectsAt(projects, d('2026-06-15T00:00:00Z'))).toBe(1);
  });
});

describe('bolívares', () => {
  it('convierte y redondea una sola vez, al final', () => {
    expect(usdToBolivares(39, 36.12345678)).toBe(1408.81);
  });

  it('rechaza tasas absurdas o con saltos de más del 20%', () => {
    expect(isPlausibleRate(0, null)).toBe(false);
    expect(isPlausibleRate(Number.NaN, 36)).toBe(false);
    expect(isPlausibleRate(37, null)).toBe(true);
    expect(isPlausibleRate(40, 36)).toBe(true);
    expect(isPlausibleRate(45, 36)).toBe(false);
  });
});
