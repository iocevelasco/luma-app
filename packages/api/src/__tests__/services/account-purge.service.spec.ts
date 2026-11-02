import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_PURGE_RETENTION_DAYS } from '@luma/shared';

/**
 * Modelos de mentira, creados una sola vez: el servicio guarda las referencias
 * que le damos al importarlo. Lo que devuelven se configura por test en `state`
 * y cada llamada queda en `calls`, en orden, para probar QUÉ se limpia y en
 * QUÉ orden sin una base de datos.
 */
const mock = vi.hoisted(() => {
  const calls: string[] = [];
  const state: Record<string, { rows?: unknown[]; distinct?: unknown[]; count?: number }> = {};

  function fakeModel(name: string) {
    const record = (op: string) =>
      vi.fn(async () => {
        calls.push(`${name}.${op}`);
        return {};
      });
    return {
      find: vi.fn(() => {
        calls.push(`${name}.find`);
        const rows = state[name]?.rows ?? [];
        const chain = {
          select: () => chain,
          lean: async () => rows,
          distinct: async () => state[name]?.distinct ?? [],
          then: (resolve: (value: unknown) => unknown) => resolve(rows),
        };
        return chain;
      }),
      countDocuments: vi.fn(async () => state[name]?.count ?? 0),
      updateMany: record('updateMany'),
      updateOne: record('updateOne'),
      deleteMany: record('deleteMany'),
    };
  }

  const names = [
    'Activity',
    'FeedbackResponse',
    'Notification',
    'Organization',
    'OrganizationMember',
    'Project',
    'ProjectClient',
    'ProjectMembership',
    'Subscription',
    'SubscriptionPayment',
    'User',
  ] as const;
  const models = Object.fromEntries(names.map((name) => [name, fakeModel(name)])) as Record<
    (typeof names)[number],
    ReturnType<typeof fakeModel>
  >;

  return { calls, state, models, deleteObject: vi.fn(), stripeRequest: vi.fn() };
});

const { calls, state, models, deleteObject, stripeRequest } = mock;

vi.mock('../../models/Activity.js', () => ({ Activity: mock.models.Activity }));
vi.mock('../../models/FeedbackResponse.js', () => ({ FeedbackResponse: mock.models.FeedbackResponse }));
vi.mock('../../models/Notification.js', () => ({ Notification: mock.models.Notification }));
vi.mock('../../models/Organization.js', () => ({ Organization: mock.models.Organization }));
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: mock.models.OrganizationMember,
}));
vi.mock('../../models/Project.js', () => ({ Project: mock.models.Project }));
vi.mock('../../models/ProjectClient.js', () => ({ ProjectClient: mock.models.ProjectClient }));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: mock.models.ProjectMembership,
}));
vi.mock('../../models/Subscription.js', () => ({ Subscription: mock.models.Subscription }));
vi.mock('../../models/SubscriptionPayment.js', () => ({
  SubscriptionPayment: mock.models.SubscriptionPayment,
}));
vi.mock('../../models/User.js', () => ({ User: mock.models.User }));
vi.mock('../../services/storage.service.js', () => ({ deleteObject: mock.deleteObject }));
vi.mock('../../services/stripe.client.js', () => {
  class StripeNotConfiguredError extends Error {}
  class StripeApiError extends Error {
    constructor(readonly status: number) {
      super('stripe');
    }
  }
  return { stripeRequest: mock.stripeRequest, StripeNotConfiguredError, StripeApiError };
});

const { PURGED_NAME, expiredAccountsFilter, purgeAccount, purgeExpiredAccounts, purgedEmail } =
  await import('../../services/account-purge.service.js');

const NOW = new Date('2026-12-01T00:00:00.000Z');
const USER = { id: 'u1', email: 'Ana@Estudio.com', name: 'Ana Pérez' };

/** Por defecto: una Empresa donde era la única persona, y dos obras. */
function arrange(overrides: Partial<typeof state> = {}) {
  calls.length = 0;
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, {
    OrganizationMember: { rows: [{ organization: 'org1' }], count: 0 },
    ProjectMembership: { distinct: ['p1'] },
    Project: { distinct: ['p2'] },
    ...overrides,
  });
}

function lastCall(model: keyof typeof models, op: 'updateMany' | 'updateOne' | 'deleteMany', n = 0) {
  return vi.mocked(models[model][op]).mock.calls[n] as unknown as unknown[];
}

describe('expiredAccountsFilter', () => {
  it('toma bajas con deactivated_at vencido, o sin fecha pero sin tocar desde hace la retención', () => {
    const filter = expiredAccountsFilter(NOW);
    const cutoff = filter.$or[0].deactivated_at.$lte as Date;
    expect((NOW.getTime() - cutoff.getTime()) / 86_400_000).toBe(ACCOUNT_PURGE_RETENTION_DAYS);
    expect(filter.account_status).toBe('inactive');
    expect(filter.purgedAt).toEqual({ $exists: false });
    // El respaldo: una baja sin fecha no puede quedar fuera para siempre.
    expect(filter.$or[1]).toEqual({ deactivated_at: null, updatedAt: { $lte: cutoff } });
  });
});

describe('purgeAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeRequest.mockResolvedValue({});
    arrange();
  });

  it('borra lo de afuera (comprobantes y cliente de Stripe) antes de escribir en la base', async () => {
    arrange({
      SubscriptionPayment: { rows: [{ receipt: { key: 'rec-1' } }] },
      Subscription: { rows: [{ stripeCustomerId: 'cus_1' }] },
    });
    await purgeAccount(USER, NOW);

    expect(deleteObject).toHaveBeenCalledWith('rec-1');
    expect(stripeRequest).toHaveBeenCalledWith('DELETE', '/customers/cus_1');
    const firstWrite = calls.findIndex((c) => /updateMany|deleteMany|updateOne/.test(c));
    expect(firstWrite).toBeGreaterThan(-1);
    expect(calls.slice(0, firstWrite)).toContain('SubscriptionPayment.find');
    expect(calls.slice(0, firstWrite)).toContain('Subscription.find');
  });

  it('la cuenta se marca purgada al final: si algo falla antes, se reintenta', async () => {
    await purgeAccount(USER, NOW);
    expect(calls.at(-1)).toBe('User.updateOne');
  });

  it('si Stripe falla no marca la cuenta, y propaga el error', async () => {
    arrange({ Subscription: { rows: [{ stripeCustomerId: 'cus_1' }] } });
    stripeRequest.mockRejectedValue(new Error('timeout'));

    await expect(purgeAccount(USER, NOW)).rejects.toThrow('timeout');
    expect(calls).not.toContain('User.updateOne');
    expect(calls.some((c) => /updateMany|deleteMany/.test(c))).toBe(false);
  });

  it('anonimiza el User y le saca contraseña, tokens e IP', async () => {
    await purgeAccount(USER, NOW);
    const [filter, update] = lastCall('User', 'updateOne') as [
      { _id: string },
      { $set: Record<string, unknown>; $unset: Record<string, unknown> },
    ];
    expect(filter).toEqual({ _id: 'u1' });
    expect(update.$set).toMatchObject({
      email: purgedEmail('u1'),
      name: PURGED_NAME,
      enabled: false,
      purgedAt: NOW,
    });
    expect(Object.keys(update.$unset)).toEqual(
      expect.arrayContaining(['password', 'picture', 'termsAcceptedIp', 'termsAcceptedUserAgent']),
    );
  });

  it('una Empresa donde era la única persona queda sin nombre ni contacto', async () => {
    await purgeAccount(USER, NOW);
    const [filter, update] = lastCall('Organization', 'updateMany', 0) as [
      { _id: { $in: unknown[] } },
      { $set: { name: string }; $unset: Record<string, unknown> },
    ];
    expect(filter._id.$in).toEqual(['org1']);
    expect(update.$set.name).toBe('Empresa eliminada');
    expect(Object.keys(update.$unset)).toEqual(['contactEmail', 'contactPhone']);
  });

  it('una Empresa que sigue con otras personas no se renombra ni pierde su Stripe', async () => {
    arrange({
      OrganizationMember: { rows: [{ organization: 'org1' }], count: 2 },
      Subscription: { rows: [{ stripeCustomerId: 'cus_1' }] },
    });
    await purgeAccount(USER, NOW);

    const [soleFilter] = lastCall('Organization', 'updateMany', 0) as [{ _id: { $in: unknown[] } }];
    expect(soleFilter._id.$in).toEqual([]);
    // De la compartida sólo se saca el correo de contacto, y únicamente si era el suyo.
    const [sharedFilter, sharedUpdate] = lastCall('Organization', 'updateMany', 1) as [
      Record<string, unknown>,
      { $unset: Record<string, unknown> },
    ];
    expect(sharedFilter).toMatchObject({ _id: { $in: ['org1'] }, contactEmail: 'ana@estudio.com' });
    expect(sharedUpdate.$unset).toEqual({ contactEmail: '' });
  });

  it('limpia sus pagos de la suscripción pero deja montos y fechas', async () => {
    await purgeAccount(USER, NOW);
    const [, update] = lastCall('SubscriptionPayment', 'updateMany') as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toEqual({ bank: null, reference: null, payerId: null, receipt: null });
  });

  it('borra su bandeja y sus accesos', async () => {
    await purgeAccount(USER, NOW);
    for (const model of ['Notification', 'FeedbackResponse', 'ProjectMembership', 'ProjectClient'] as const) {
      expect(models[model].deleteMany).toHaveBeenCalledWith({ user: 'u1' });
    }
  });

  it('pisa su nombre como responsable de tareas, por referencia y por nombre dentro de sus obras', async () => {
    await purgeAccount(USER, NOW);
    expect(lastCall('Activity', 'updateMany', 0)[0]).toEqual({ 'responsible.user': 'u1' });
    expect(lastCall('Activity', 'updateMany', 1)[0]).toMatchObject({
      project: { $in: ['p1', 'p2'] },
      'responsible.user': null,
    });
  });

  it('escapa el nombre al buscarlo: «Ana (Obra) .*» no es una expresión regular', async () => {
    await purgeAccount({ ...USER, name: 'Ana (Obra) .*' }, NOW);
    const [filter] = lastCall('Activity', 'updateMany', 1) as [Record<string, { $regex: string }>];
    expect(filter['responsible.name'].$regex).toBe('^Ana \\(Obra\\) \\.\\*$');
  });
});

describe('purgeExpiredAccounts', () => {
  it('cuenta la falla de una cuenta y sigue con las demás', async () => {
    vi.clearAllMocks();
    arrange({
      User: {
        rows: [
          { _id: 'a', email: 'a@x.com', name: 'A' },
          { _id: 'b', email: 'b@x.com', name: 'B' },
        ],
      },
    });
    // La primera cuenta falla al leer sus Empresas; la segunda sigue.
    vi.mocked(models.OrganizationMember.find).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const run = await purgeExpiredAccounts(NOW);

    expect(run).toEqual({ checked: 2, purged: 1, failed: 1 });
  });
});
