import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyActionCounts, type PlatformAction } from '@luma/shared';

/**
 * Embudo y seguimiento: el embudo es una cadena de etapas, el semáforo manda a
 * las cuentas con riesgo arriba y la lista nunca lleva contenido de las obras.
 * La clasificación, las acciones y los modelos van mockeados; se prueba el cruce.
 */
vi.mock('../../models/User.js', () => ({ User: { find: vi.fn() } }));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: { aggregate: vi.fn() },
}));
vi.mock('../../services/platform-accounts.service.js', () => ({ classifyAccounts: vi.fn() }));
vi.mock('../../services/platform-activity.service.js', () => ({ actorActivityStats: vi.fn() }));

const { User } = await import('../../models/User.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { classifyAccounts } = await import('../../services/platform-accounts.service.js');
const { actorActivityStats } = await import('../../services/platform-activity.service.js');
const { buildFollowUp, buildFunnel, loadMemberProgress, platformFollowUp } = await import(
  '../../services/platform-follow-up.service.js'
);

const NOW = new Date('2026-11-06T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

function counts(partial: Partial<Record<PlatformAction, number>> = {}) {
  return { ...emptyActionCounts(), ...partial };
}

function member(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Cuenta ${id}`,
    email: `${id}@ejemplo.com`,
    createdAt: daysAgo(10),
    emailVerified: true,
    status: 'prueba' as const,
    trialDaysLeft: 20,
    counts: counts(),
    last: null,
    invitedByRole: {},
    ...overrides,
  };
}

const QUERY = { filter: 'all', q: '', page: 1, pageSize: 20 } as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildFunnel', () => {
  it('cuenta cada etapa como cadena: nunca crece hacia abajo', () => {
    const funnel = buildFunnel(
      [
        member('a'), // confirmó el correo, nada más
        member('b', { counts: counts({ projectCreated: 1 }) }),
        member('c', { counts: counts({ projectCreated: 1, memberInvited: 2, activityCreated: 3 }) }),
        // gasto sin haber invitado a nadie: no salta la etapa de invitar
        member('d', { counts: counts({ projectCreated: 1, expenseRegistered: 4 }) }),
      ],
      NOW,
    );

    expect(funnel.stages.map((stage) => stage.count)).toEqual([4, 4, 3, 1, 1, 0]);
    const counted = funnel.stages.map((stage) => stage.count);
    expect(counted).toEqual([...counted].sort((x, y) => y - x));
  });

  it('una cuenta con obra cuenta como correo confirmado aunque email_verified sea false', () => {
    const funnel = buildFunnel(
      [member('a', { emailVerified: false, counts: counts({ projectCreated: 1 }) })],
      NOW,
    );

    expect(funnel.stages[1].count).toBe(1);
  });

  it('arma seis cohortes semanales y deja fuera las altas más viejas', () => {
    const funnel = buildFunnel(
      [
        member('reciente', { createdAt: daysAgo(1), counts: counts({ projectCreated: 1 }) }),
        member('vieja', { createdAt: daysAgo(200) }),
      ],
      NOW,
    );

    expect(funnel.cohorts).toHaveLength(6);
    expect(funnel.cohorts[5]).toMatchObject({ weekStart: '2026-11-02', size: 1 });
    expect(funnel.cohorts[5].reached.slice(0, 3)).toEqual([1, 1, 1]);
    expect(funnel.cohorts.reduce((sum, cohort) => sum + cohort.size, 0)).toBe(1);
    // La cuenta vieja igual entra en el embudo general.
    expect(funnel.stages[0].count).toBe(2);
  });

  it('activas en 7 días son las que hicieron una acción en la última semana', () => {
    const funnel = buildFunnel(
      [
        member('hoy', { last: daysAgo(0) }),
        member('hace6', { last: daysAgo(6) }),
        member('hace8', { last: daysAgo(8) }),
        member('nunca', { last: null }),
      ],
      NOW,
    );

    expect(funnel.active7d).toBe(2);
  });
});

describe('buildFollowUp', () => {
  const trabada = member('trabada', { emailVerified: true, createdAt: daysAgo(6) });
  const enMarcha = member('marcha', {
    createdAt: daysAgo(14),
    counts: counts({ projectCreated: 1, memberInvited: 1 }),
    last: daysAgo(1),
  });
  const vencida = member('vencida', { status: 'vencida', trialDaysLeft: null, createdAt: daysAgo(40) });
  const paga = member('paga', {
    status: 'activa',
    trialDaysLeft: null,
    createdAt: daysAgo(20),
    counts: counts({ projectCreated: 1, expenseRegistered: 1, memberInvited: 1, activityCreated: 2 }),
    last: daysAgo(0),
  });
  const all = [enMarcha, trabada, paga, vencida];

  it('pone primero las que necesitan atención y después la más nueva', () => {
    const page = buildFollowUp(all, QUERY, NOW);

    expect(page.rows.map((row) => row.id)).toEqual(['trabada', 'vencida', 'marcha', 'paga']);
    expect(page.rows.map((row) => row.risk)).toEqual([true, true, false, false]);
  });

  it('cada fila trae su semáforo y su etapa', () => {
    const rows = buildFollowUp(all, QUERY, NOW).rows;
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

    expect(byId.trabada).toMatchObject({ health: 'noProject', stage: 'emailConfirmed' });
    expect(byId.vencida).toMatchObject({ health: 'expired', membership: 'vencida' });
    expect(byId.paga).toMatchObject({ health: 'ok', stage: 'firstMoney', activities: 2 });
  });

  it('los contadores de los filtros respetan la búsqueda y no el filtro elegido', () => {
    const page = buildFollowUp(all, { ...QUERY, filter: 'expired' }, NOW);

    expect(page.counts).toEqual({ all: 4, risk: 2, trial: 2, paying: 1, expired: 1 });
    expect(page.rows.map((row) => row.id)).toEqual(['vencida']);

    const searched = buildFollowUp(all, { ...QUERY, q: 'MARCHA' }, NOW);
    expect(searched.counts.all).toBe(1);
    expect(searched.rows[0].id).toBe('marcha');
  });

  it('pagina después de ordenar y devuelve 1 página aunque no haya filas', () => {
    const second = buildFollowUp(all, { ...QUERY, page: 2, pageSize: 3 }, NOW);
    expect(second).toMatchObject({ total: 4, pages: 2, page: 2 });
    expect(second.rows.map((row) => row.id)).toEqual(['paga']);

    expect(buildFollowUp([], QUERY, NOW)).toMatchObject({ total: 0, pages: 1, rows: [] });
  });

  it('no lleva contenido: solo cantidades por rol, nunca quiénes son', () => {
    const row = buildFollowUp(
      [member('x', { invitedByRole: { cliente: 2, supervisor: 1 }, counts: counts({ memberInvited: 3 }) })],
      QUERY,
      NOW,
    ).rows[0];

    expect(row.invited).toBe(3);
    expect(row.invitedByRole).toEqual({ cliente: 2, supervisor: 1 });
    expect(Object.keys(row).sort()).toEqual(
      [
        'activities',
        'createdAt',
        'email',
        'health',
        'id',
        'invited',
        'invitedByRole',
        'lastActionAt',
        'membership',
        'name',
        'projects',
        'risk',
        'stage',
        'trialDaysLeft',
      ].sort(),
    );
  });
});

describe('loadMemberProgress', () => {
  function mockLoad() {
    vi.mocked(classifyAccounts).mockResolvedValue([
      {
        id: 'u1',
        segment: 'membership',
        membership: 'trial',
        subscription: { status: 'prueba', trialDaysLeft: 12 },
        staffRole: null,
        createdAt: daysAgo(5),
      },
      {
        id: 'u2',
        segment: 'client',
        membership: null,
        subscription: null,
        staffRole: null,
        createdAt: daysAgo(5),
      },
    ] as never);
    vi.mocked(User.find).mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([{ _id: 'u1', name: 'Ana', email: 'ana@ejemplo.com', email_verified: true }]),
      }),
    } as never);
    vi.mocked(actorActivityStats).mockResolvedValue(
      new Map([['u1', { counts: counts({ projectCreated: 2 }), last: daysAgo(1) }]]),
    );
    vi.mocked(ProjectMembership.aggregate).mockResolvedValue([
      { _id: { by: 'u1', role: 'cliente' }, n: 2 },
      { _id: { by: 'u1', role: 'supervisor' }, n: 1 },
      { _id: { by: 'otro', role: 'cliente' }, n: 9 },
    ] as never);
  }

  it('trae solo las cuentas con membresía, con su actividad y sus invitados por rol', async () => {
    mockLoad();

    const members = await loadMemberProgress(NOW);

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      id: 'u1',
      name: 'Ana',
      status: 'prueba',
      trialDaysLeft: 12,
      invitedByRole: { cliente: 2, supervisor: 1 },
    });
    expect(members[0].counts.projectCreated).toBe(2);
    const query = vi.mocked(User.find).mock.calls[0][0] as { _id: { $in: string[] } };
    expect(query._id.$in).toEqual(['u1']);
  });

  it('una cuenta sin acciones trae los contadores en cero', async () => {
    mockLoad();
    vi.mocked(actorActivityStats).mockResolvedValue(new Map());

    const [only] = await loadMemberProgress(NOW);

    expect(only.last).toBeNull();
    expect(only.counts).toEqual(emptyActionCounts());
  });

  it('platformFollowUp junta la carga con el armado de la página', async () => {
    mockLoad();

    const page = await platformFollowUp(QUERY, NOW);

    expect(page.total).toBe(1);
    expect(page.rows[0]).toMatchObject({ id: 'u1', stage: 'firstProject', projects: 2 });
  });
});
