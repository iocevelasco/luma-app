import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las reglas viven en `@luma/shared/billing` y tienen su propio test. Acá se
 * prueba el cableado: que los hechos salgan bien de la base, que la prueba de
 * un invitado arranque con su primera obra y que no se reinicie nunca.
 */
vi.mock('../../models/Subscription.js', () => ({
  Subscription: { findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../../models/SubscriptionPayment.js', () => ({
  SubscriptionPayment: { find: vi.fn() },
}));
vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn() } }));
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: {
    findOne: () => ({ select: () => Promise.resolve({ user: 'owner-1' }) }),
  },
}));

const { Subscription } = await import('../../models/Subscription.js');
const { SubscriptionPayment } = await import('../../models/SubscriptionPayment.js');
const { Project } = await import('../../models/Project.js');
const { decideProjectCreation, startTrialFor, statesFor, summaryFor } = await import(
  '../../services/subscription.service.js'
);

const NOW = new Date('2026-10-20T12:00:00.000Z');

function projects(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    _id: `p${i}`,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    archivedAt: null,
  }));
}

function given(opts: {
  subscription?: Record<string, unknown> | null;
  payments?: Record<string, unknown>[];
  projectCount?: number;
}) {
  vi.mocked(Subscription.findOne).mockResolvedValue((opts.subscription ?? null) as never);
  vi.mocked(SubscriptionPayment.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(opts.payments ?? []),
  } as never);
  vi.mocked(Project.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(projects(opts.projectCount ?? 0)),
  } as never);
}

const inTrial = {
  trialStartedAt: new Date('2026-10-10T00:00:00.000Z'),
  trialEndsAt: new Date('2026-11-09T00:00:00.000Z'),
  trialEndedEarlyAt: null,
};

describe('decideProjectCreation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('la primera obra de un invitado le arranca la prueba (regla C)', async () => {
    given({ subscription: null, projectCount: 0 });

    const decision = await decideProjectCreation('org-1', 'user-1', NOW);

    expect(decision).toEqual({ allowed: true, startsTrial: true, isExtra: false });
    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1' },
      {
        $setOnInsert: expect.objectContaining({
          owner: 'user-1',
          trialStartedAt: NOW,
          trialEndsAt: new Date('2026-11-19T12:00:00.000Z'),
        }),
      },
      { upsert: true },
    );
  });

  it('en prueba con 3 obras no deja crear la cuarta y no toca la suscripción', async () => {
    given({ subscription: inTrial, projectCount: 3 });

    const decision = await decideProjectCreation('org-1', 'user-1', NOW);

    expect(decision).toEqual({ allowed: false, code: 'PAID_PLAN_REQUIRED' });
    expect(Subscription.updateOne).not.toHaveBeenCalled();
  });
});

describe('startTrialFor', () => {
  it('usa $setOnInsert: una prueba existente nunca se reinicia', async () => {
    vi.clearAllMocks();
    await startTrialFor('org-1', 'user-1', NOW);

    const [, update] = vi.mocked(Subscription.updateOne).mock.calls[0]!;
    expect(Object.keys(update as object)).toEqual(['$setOnInsert']);
  });
});

describe('statesFor', () => {
  it('resuelve cada Empresa con sus propios pagos', async () => {
    vi.clearAllMocks();
    vi.mocked(Subscription.find).mockResolvedValue([
      { organization: 'org-a', ...inTrial, stripeStatus: null },
      {
        organization: 'org-b',
        trialStartedAt: new Date('2026-08-01T00:00:00.000Z'),
        trialEndsAt: new Date('2026-08-31T00:00:00.000Z'),
        trialEndedEarlyAt: null,
        stripeStatus: null,
      },
    ] as never);
    vi.mocked(SubscriptionPayment.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        {
          organization: 'org-b',
          periodStart: new Date('2026-10-01T00:00:00.000Z'),
          periodEnd: new Date('2026-11-01T00:00:00.000Z'),
          status: 'aprobado',
          submittedAt: new Date('2026-09-30T00:00:00.000Z'),
        },
      ]),
    } as never);

    const states = await statesFor(['org-a', 'org-b', 'org-c', 'org-a'], NOW);

    expect(states.get('org-a')?.status).toBe('prueba');
    expect(states.get('org-b')?.status).toBe('activa');
    // Sin suscripción: un invitado que nunca creó obras.
    expect(states.get('org-c')?.status).toBe('sin_iniciar');
    expect(states.size).toBe(3);
  });
});

describe('summaryFor', () => {
  it('en prueba, el próximo cobro arranca cuando termina la prueba y sin prorrateo', async () => {
    vi.clearAllMocks();
    given({ subscription: inTrial, projectCount: 2 });

    const summary = await summaryFor('org-1', NOW);

    expect(summary.status).toBe('prueba');
    expect(summary.trialDaysLeft).toBe(20);
    expect(summary.activeProjects).toBe(2);
    expect(summary.nextCharge?.periodStart).toBe('2026-11-09T00:00:00.000Z');
    expect(summary.nextCharge?.totalUsd).toBe(39);
  });

  it('sin iniciar no tiene próximo cobro', async () => {
    vi.clearAllMocks();
    given({ subscription: null });

    const summary = await summaryFor('org-1', NOW);

    expect(summary.status).toBe('sin_iniciar');
    expect(summary.nextCharge).toBeNull();
  });
});

describe('summaryFor: Empresas de antes del sistema de suscripción', () => {
  it('con obras y sin suscripción, le arranca el mes gratis hoy en vez de decir que arranca con la primera obra', async () => {
    vi.clearAllMocks();
    vi.mocked(Subscription.findOne)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        trialStartedAt: NOW,
        trialEndsAt: new Date('2026-11-19T12:00:00.000Z'),
        trialEndedEarlyAt: null,
      } as never);
    vi.mocked(SubscriptionPayment.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      select: vi.fn().mockResolvedValue(projects(2)),
    } as never);

    const summary = await summaryFor('org-1', NOW);

    expect(Subscription.updateOne).toHaveBeenCalledWith(
      { organization: 'org-1' },
      { $setOnInsert: expect.objectContaining({ owner: 'owner-1', trialStartedAt: NOW }) },
      { upsert: true },
    );
    expect(summary.status).toBe('prueba');
    expect(summary.trialDaysLeft).toBe(30);
  });
});

