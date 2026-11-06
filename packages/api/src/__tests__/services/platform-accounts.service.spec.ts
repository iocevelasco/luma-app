import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionState } from '@luma/shared';

/**
 * Censo de cuentas: el segmento sale de cruzar la suscripción de la Empresa que
 * la persona posee con sus roles en obras ajenas. Los modelos y la lectura del
 * estado de suscripción van mockeados; lo que se prueba es el cruce.
 */
vi.mock('../../models/User.js', () => ({
  User: { find: vi.fn(), countDocuments: vi.fn() },
}));
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: { find: vi.fn() },
}));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: { aggregate: vi.fn() },
}));
vi.mock('../../services/subscription.service.js', () => ({
  statesFor: vi.fn(),
}));

const { User } = await import('../../models/User.js');
const { OrganizationMember } = await import('../../models/OrganizationMember.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { statesFor } = await import('../../services/subscription.service.js');
const { buildCensus, classifyAccounts, platformCensus, segmentsById } = await import(
  '../../services/platform-accounts.service.js'
);

const NOW = new Date('2026-11-05T12:00:00.000Z');

function state(status: SubscriptionState['status']): SubscriptionState {
  return { status, canWrite: status !== 'vencida', accessUntil: null, trialDaysLeft: null };
}

function user(id: string, overrides: Record<string, unknown> = {}) {
  return { _id: id, account_status: 'active', createdAt: new Date('2026-11-04T10:00:00.000Z'), ...overrides };
}

function mockData({
  users,
  owners = [],
  states = {},
  roles = [],
}: {
  users: unknown[];
  owners?: Array<{ user: string; organization: string }>;
  states?: Record<string, SubscriptionState['status']>;
  roles?: Array<{ _id: string; roles: string[] }>;
}) {
  vi.mocked(User.find).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(users) }),
  } as never);
  vi.mocked(OrganizationMember.find).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(owners) }),
  } as never);
  vi.mocked(ProjectMembership.aggregate).mockResolvedValue(roles as never);
  vi.mocked(statesFor).mockResolvedValue(
    new Map(Object.entries(states).map(([org, status]) => [org, state(status)])),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyAccounts', () => {
  it('cruza suscripción y roles de obra con la precedencia de shared', async () => {
    mockData({
      users: [
        user('holder'),
        user('trial-and-supervisor'),
        user('guest-client'),
        user('guest-staff'),
        user('gone', { account_status: 'inactive' }),
        user('nobody'),
      ],
      owners: [
        { user: 'holder', organization: 'org-holder' },
        { user: 'trial-and-supervisor', organization: 'org-ts' },
        { user: 'guest-client', organization: 'org-gc' },
        { user: 'guest-staff', organization: 'org-gs' },
        { user: 'gone', organization: 'org-gone' },
        { user: 'nobody', organization: 'org-nobody' },
      ],
      states: {
        'org-holder': 'activa',
        'org-ts': 'prueba',
        'org-gc': 'sin_iniciar',
        'org-gs': 'sin_iniciar',
        'org-gone': 'prueba',
        'org-nobody': 'sin_iniciar',
      },
      roles: [
        { _id: 'trial-and-supervisor', roles: ['supervisor'] },
        { _id: 'guest-client', roles: ['cliente'] },
        { _id: 'guest-staff', roles: ['cliente', 'contador'] },
      ],
    });

    const segments = segmentsById(await classifyAccounts(NOW));

    expect(Object.fromEntries(segments)).toEqual({
      holder: 'membership',
      'trial-and-supervisor': 'membership',
      'guest-client': 'client',
      'guest-staff': 'staff',
      gone: 'inactive',
      nobody: 'noProject',
    });
  });

  it('una persona que es dueña de dos Empresas cuenta la que ya empezó', async () => {
    mockData({
      users: [user('two')],
      owners: [
        { user: 'two', organization: 'org-a' },
        { user: 'two', organization: 'org-b' },
      ],
      states: { 'org-a': 'sin_iniciar', 'org-b': 'vencida' },
    });

    const [account] = await classifyAccounts(NOW);

    expect(account).toMatchObject({ segment: 'membership', membership: 'expired' });
  });

  it('pide las cuentas sin las de prueba', async () => {
    mockData({ users: [] });

    await classifyAccounts(NOW);

    const filter = vi.mocked(User.find).mock.calls[0][0] as { email: { $not: RegExp } };
    expect(filter.email.$not.test('e2e@luma.test')).toBe(true);
    expect(filter.email.$not.test('persona@gmail.com')).toBe(false);
  });

  it('lee en lote: una consulta de suscripciones para todas las Empresas', async () => {
    mockData({
      users: [user('a'), user('b')],
      owners: [
        { user: 'a', organization: 'org-a' },
        { user: 'b', organization: 'org-b' },
      ],
      states: { 'org-a': 'prueba', 'org-b': 'prueba' },
    });

    await classifyAccounts(NOW);

    expect(statesFor).toHaveBeenCalledTimes(1);
    expect(vi.mocked(statesFor).mock.calls[0][0]).toEqual(['org-a', 'org-b']);
  });
});

describe('buildCensus', () => {
  const account = (
    id: string,
    segment: 'membership' | 'staff' | 'client' | 'noProject' | 'inactive',
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    segment,
    membership: null,
    staffRole: null,
    createdAt: new Date('2026-11-04T10:00:00.000Z'),
    ...extra,
  });

  it('cuenta cada segmento y el estado de las membresías', () => {
    const census = buildCensus(
      [
        account('a', 'membership', { membership: 'trial' }),
        account('b', 'membership', { membership: 'trial' }),
        account('c', 'membership', { membership: 'paying' }),
        account('d', 'client'),
        account('e', 'inactive'),
      ],
      3,
      NOW,
    );

    expect(census.total).toBe(5);
    expect(census.segments).toEqual({
      inactive: 1,
      membership: 3,
      staff: 0,
      client: 1,
      noProject: 0,
    });
    expect(census.memberships).toEqual({ trial: 2, paying: 1, unlimited: 0, expired: 0 });
    expect(census.testAccounts).toBe(3);
  });

  it('las cuentas de prueba no suman al total', () => {
    const census = buildCensus([account('a', 'client')], 23, NOW);

    expect(census.total).toBe(1);
    expect(census.testAccounts).toBe(23);
  });

  it('funde los roles chicos y omite el que no llega al mínimo', () => {
    const staff = (id: string, staffRole: string) => account(id, 'staff', { staffRole });
    const accounts = [
      ...Array.from({ length: 6 }, (_, i) => staff(`s${i}`, 'supervisor')),
      staff('d1', 'disenador'),
      staff('d2', 'disenador'),
    ];

    const census = buildCensus(accounts, 0, NOW);

    expect(census.segments.staff).toBe(8);
    expect(census.staffRoles).toEqual([{ role: 'supervisor', people: 6 }]);
  });

  it('la curva trae 12 semanas, con 0 donde no hubo altas, separando membresía del resto', () => {
    const census = buildCensus(
      [
        account('a', 'membership', { createdAt: new Date('2026-11-03T10:00:00.000Z') }),
        account('b', 'client', { createdAt: new Date('2026-11-04T10:00:00.000Z') }),
        account('c', 'client', { createdAt: new Date('2025-01-01T10:00:00.000Z') }),
      ],
      0,
      NOW,
    );

    expect(census.signups).toHaveLength(12);
    expect(census.signups[11]).toEqual({ weekStart: '2026-11-02', members: 1, others: 1 });
    expect(census.signups[0]).toEqual({ weekStart: '2026-08-17', members: 0, others: 0 });
    // La cuenta de enero de 2025 queda fuera de la ventana.
    expect(census.signups.reduce((sum, week) => sum + week.members + week.others, 0)).toBe(2);
  });
});

describe('platformCensus', () => {
  it('junta la clasificación con el conteo de cuentas de prueba', async () => {
    mockData({ users: [user('a')], owners: [{ user: 'a', organization: 'org-a' }], states: { 'org-a': 'ilimitado' } });
    vi.mocked(User.countDocuments).mockResolvedValue(7 as never);

    const census = await platformCensus(NOW);

    expect(census.segments.membership).toBe(1);
    expect(census.memberships.unlimited).toBe(1);
    expect(census.testAccounts).toBe(7);
    const filter = vi.mocked(User.countDocuments).mock.calls[0][0] as { email: RegExp };
    expect(filter.email.test('e2e@luma.test')).toBe(true);
  });
});
