import { PLATFORM_ACTIONS } from '@luma/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Actividad por rol: el rol sale de la obra donde se hizo la acción, las
 * cuentas de prueba no cuentan, y una celda con menos de 5 personas sale del
 * servidor sin cifras. Las consultas a Mongo se simulan; lo que se prueba es
 * la atribución y la supresión.
 */
const model = () => ({ aggregate: vi.fn().mockResolvedValue([]), find: vi.fn() });
const leanResult = (rows: unknown[]) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
});

vi.mock('../../models/Activity.js', () => ({ Activity: model() }));
vi.mock('../../models/Budget.js', () => ({ Budget: model() }));
vi.mock('../../models/Expense.js', () => ({ Expense: model() }));
vi.mock('../../models/LaborRecord.js', () => ({ LaborRecord: model() }));
vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: model() }));
vi.mock('../../models/Milestone.js', () => ({ Milestone: model() }));
vi.mock('../../models/Payment.js', () => ({ Payment: model() }));
vi.mock('../../models/Project.js', () => ({ Project: model() }));
vi.mock('../../models/ProjectDocument.js', () => ({ ProjectDocument: model() }));
vi.mock('../../models/ProjectMembership.js', () => ({ ProjectMembership: model() }));
vi.mock('../../models/ProviderEngagement.js', () => ({ ProviderEngagement: model() }));
vi.mock('../../models/User.js', () => ({ User: model() }));

const { Expense } = await import('../../models/Expense.js');
const { Activity } = await import('../../models/Activity.js');
const { Project } = await import('../../models/Project.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { User } = await import('../../models/User.js');
const { buildActivityReport, platformActivityReport, resolveRole } = await import(
  '../../services/platform-activity.service.js'
);
type Facts = Parameters<typeof resolveRole>[2];
type Group = Parameters<typeof buildActivityReport>[0][number];

const facts = (over: Partial<Facts> = {}): Facts => ({
  owners: new Map([['p1', 'owner']]),
  memberships: new Map(),
  excluded: new Set(),
  ...over,
});

function expensesBy(actors: string[], project = 'p1', counts = { '7d': 1, '30d': 2, all: 3 }): Group[] {
  return actors.map((actor) => ({ action: 'expenseRegistered', project, actor, counts }));
}
const people = (n: number, prefix = 'u') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const role = (report: ReturnType<typeof buildActivityReport>, name: string) =>
  report.roles.find((r) => r.role === name)!;

describe('resolveRole', () => {
  it('gerente si es el dueño de esa obra, aunque no tenga membresía', () => {
    expect(resolveRole('p1', 'owner', facts())).toBe('gerente');
  });

  it('el rol de su membresía en esa obra', () => {
    const f = facts({ memberships: new Map([['p1:ana', 'supervisor']]) });
    expect(resolveRole('p1', 'ana', f)).toBe('supervisor');
  });

  it('la misma persona es gerente en una obra y supervisor en otra', () => {
    const f = facts({
      owners: new Map([['p1', 'ana'], ['p2', 'otro']]),
      memberships: new Map([['p2:ana', 'supervisor']]),
    });
    expect(resolveRole('p1', 'ana', f)).toBe('gerente');
    expect(resolveRole('p2', 'ana', f)).toBe('supervisor');
  });

  it('sin dueño ni membresía es ex-miembro', () => {
    expect(resolveRole('p1', 'nadie', facts())).toBe('exMiembro');
    expect(resolveRole('p-borrada', 'owner', facts())).toBe('exMiembro');
  });
});

describe('buildActivityReport', () => {
  it('cuenta por período y personas distintas, y atribuye por obra', () => {
    const f = facts({
      owners: new Map([['p1', 'g0'], ['p2', 'g1']]),
      memberships: new Map(people(5, 'c').map((c) => [`p1:${c}`, 'contador'])),
    });
    const groups = [
      ...expensesBy(people(5, 'c'), 'p1', { '7d': 1, '30d': 2, all: 4 }),
      // la misma persona, dos obras, mismo rol: una sola persona
      ...expensesBy(['c0'], 'p1', { '7d': 0, '30d': 1, all: 1 }),
    ];
    const cell = role(buildActivityReport(groups, f), 'contador').periods!;

    expect(cell['7d']).toMatchObject({ suppressed: false, people: 5 });
    expect(cell['7d'].actions!.expenseRegistered).toBe(5);
    expect(cell['30d'].actions!.expenseRegistered).toBe(11);
    expect(cell.all.actions!.expenseRegistered).toBe(21);
    expect(cell.all.people).toBe(5);
  });

  it('un período sin actividad no cuenta personas: sale suprimido', () => {
    const groups = expensesBy(people(5), 'p1', { '7d': 0, '30d': 0, all: 3 });
    const f = facts({ owners: new Map(), memberships: new Map(people(5).map((u) => [`p1:${u}`, 'contador'])) });
    const periods = role(buildActivityReport(groups, f), 'contador').periods!;
    expect(periods['7d']).toEqual({ suppressed: true, people: null, actions: null });
    expect(periods.all.suppressed).toBe(false);
  });

  it('suprime con 4 personas y muestra con 5', () => {
    const member = (n: number) =>
      facts({ memberships: new Map(people(n).map((u) => [`p1:${u}`, 'contador'])) });
    const four = role(buildActivityReport(expensesBy(people(4)), member(4)), 'contador');
    const five = role(buildActivityReport(expensesBy(people(5)), member(5)), 'contador');
    expect(four.periods!.all).toEqual({ suppressed: true, people: null, actions: null });
    expect(five.periods!.all.suppressed).toBe(false);
  });

  it('agrupa a los ex-miembros aparte', () => {
    const report = buildActivityReport(expensesBy(people(5, 'x')), facts());
    expect(role(report, 'exMiembro').periods!.all).toMatchObject({ suppressed: false, people: 5 });
    expect(role(report, 'contador').periods!.all.suppressed).toBe(true);
  });

  it('excluye a las cuentas de prueba', () => {
    const users = people(5);
    const f = facts({
      memberships: new Map(users.map((u) => [`p1:${u}`, 'contador'])),
      excluded: new Set(['u0']),
    });
    const cell = role(buildActivityReport(expensesBy(users), f), 'contador').periods!.all;
    expect(cell.suppressed).toBe(true);
  });

  it('el cliente es sólo lectura: sin cifras ni períodos', () => {
    const f = facts({ memberships: new Map(people(5).map((u) => [`p1:${u}`, 'cliente'])) });
    const client = role(buildActivityReport(expensesBy(people(5)), f), 'cliente');
    expect(client).toEqual({ role: 'cliente', readOnly: true, periods: null });
  });

  it('la respuesta no trae ids, nombres de obra ni montos', () => {
    const f = facts({ memberships: new Map(people(5).map((u) => [`proyecto-secreto:${u}`, 'contador'])) });
    const groups = expensesBy(people(5), 'proyecto-secreto');
    const json = JSON.stringify(buildActivityReport(groups, f));
    expect(json).not.toMatch(/proyecto-secreto|u0|owner/);
    // Sólo estas claves, y las de acciones son contadores: nada más viaja.
    const keys = new Set<string>();
    JSON.parse(json, (key, value) => {
      if (key && !/^\d+$/.test(key)) keys.add(key);
      return value;
    });
    const allowed = new Set([
      'minPeople', 'roles', 'role', 'readOnly', 'periods', '7d', '30d', 'all',
      'suppressed', 'people', 'actions', ...PLATFORM_ACTIONS,
    ]);
    expect([...keys].filter((key) => !allowed.has(key))).toEqual([]);
  });
});

describe('platformActivityReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('arma el reporte a partir de las agregaciones y resuelve roles en lote', async () => {
    const users = people(5);
    vi.mocked(Expense.aggregate).mockResolvedValue(
      users.map((u) => ({ _id: { project: 'p1', actor: u }, d7: 1, d30: 1, all: 1 })),
    );
    // Los documentos sin autor o sin obra se descartan.
    vi.mocked(Activity.aggregate).mockResolvedValue([{ _id: { project: null, actor: 'x' }, d7: 1, d30: 1, all: 1 }]);
    vi.mocked(Project.find).mockReturnValue(leanResult([{ _id: 'p1', createdBy: 'dueño' }]) as never);
    vi.mocked(ProjectMembership.find).mockReturnValue(
      leanResult(users.map((u) => ({ project: 'p1', user: u, role: 'contador' }))) as never,
    );
    vi.mocked(User.find).mockReturnValue(leanResult([]) as never);

    const report = await platformActivityReport(new Date('2026-10-28T12:00:00.000Z'));

    expect(role(report, 'contador').periods!['7d']).toMatchObject({ suppressed: false, people: 5 });
    // En lote: una consulta por colección, no una por persona.
    expect(Project.find).toHaveBeenCalledTimes(1);
    expect(ProjectMembership.find).toHaveBeenCalledTimes(1);
    expect(User.find).toHaveBeenCalledTimes(1);
  });
});
