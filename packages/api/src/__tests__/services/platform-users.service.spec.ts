import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Panel de cuentas de la plataforma: las cifras salen de contar `User`, las
 * cuentas de prueba no cuentan y la curva de altas siempre trae 12 semanas.
 */
vi.mock('../../models/User.js', () => ({
  User: { countDocuments: vi.fn(), find: vi.fn() },
}));

const { User } = await import('../../models/User.js');
const { bucketSignups, listPlatformUsers, platformUsersOverview, weekStartOf } = await import(
  '../../services/platform-users.service.js'
);

const countDocuments = vi.mocked(User.countDocuments);
const find = vi.mocked(User.find);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('weekStartOf', () => {
  it('lleva cualquier día de la semana a su lunes', () => {
    // 2026-10-21 es miércoles; su lunes es el 19.
    expect(weekStartOf(new Date('2026-10-21T15:30:00.000Z')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
    expect(weekStartOf(new Date('2026-10-19T00:00:00.000Z')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
  });

  it('trata al domingo como el último día de la semana, no el primero', () => {
    expect(weekStartOf(new Date('2026-10-25T23:59:00.000Z')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
  });
});

describe('bucketSignups', () => {
  const now = new Date('2026-10-23T12:00:00.000Z');

  it('devuelve 12 semanas, de la más vieja a la actual, con 0 donde no hubo altas', () => {
    const rows = bucketSignups([], now);

    expect(rows).toHaveLength(12);
    expect(rows[11].weekStart).toBe('2026-10-19');
    expect(rows[0].weekStart).toBe('2026-08-03');
    expect(rows.every((row) => row.count === 0)).toBe(true);
  });

  it('suma cada alta en la semana que le toca y descarta las anteriores a la ventana', () => {
    const rows = bucketSignups(
      [
        new Date('2026-10-20T09:00:00.000Z'),
        new Date('2026-10-22T09:00:00.000Z'),
        new Date('2026-10-12T09:00:00.000Z'),
        new Date('2026-01-05T09:00:00.000Z'),
      ],
      now,
    );

    expect(rows.find((row) => row.weekStart === '2026-10-19')?.count).toBe(2);
    expect(rows.find((row) => row.weekStart === '2026-10-12')?.count).toBe(1);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });
});

describe('platformUsersOverview', () => {
  it('deriva inactivas y sin confirmar de los conteos, y deja afuera @luma.test', async () => {
    countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(8).mockResolvedValueOnce(5);
    const lean = vi.fn().mockResolvedValue([{ createdAt: new Date('2026-10-20T10:00:00.000Z') }]);
    find.mockReturnValue({ select: vi.fn(() => ({ lean })) } as never);

    const overview = await platformUsersOverview(new Date('2026-10-23T12:00:00.000Z'));

    expect(overview.stats).toEqual({ total: 10, active: 8, inactive: 2, verified: 5, unverified: 3 });
    expect(overview.signups).toHaveLength(12);
    expect(overview.signups[11].count).toBe(1);

    const regex = (countDocuments.mock.calls[0][0] as { email: { $not: RegExp } }).email.$not;
    expect(regex.test('e2e-admin@luma.test')).toBe(true);
    expect(regex.test('persona@gmail.com')).toBe(false);
  });
});

describe('listPlatformUsers', () => {
  const user = {
    _id: 'u1',
    name: 'Ana Pérez',
    email: 'ana@estudio.com',
    role: 'user',
    email_verified: false,
    account_status: 'active',
    createdAt: new Date('2026-10-20T10:00:00.000Z'),
  };

  function mockPage(users: unknown[]) {
    const limit = vi.fn().mockResolvedValue(users);
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    find.mockReturnValue({ sort } as never);
    return { sort, skip, limit };
  }

  it('pagina, ordena por alta descendente y devuelve las filas sin campos internos', async () => {
    const { sort, skip, limit } = mockPage([user]);
    countDocuments.mockResolvedValue(41);

    const page = await listPlatformUsers({ filter: 'all', q: '', page: 3, pageSize: 20 });

    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skip).toHaveBeenCalledWith(40);
    expect(limit).toHaveBeenCalledWith(20);
    expect(page).toMatchObject({ total: 41, page: 3, pageSize: 20, pages: 3 });
    expect(page.users[0]).toEqual({
      id: 'u1',
      name: 'Ana Pérez',
      email: 'ana@estudio.com',
      role: 'user',
      emailVerified: false,
      accountStatus: 'active',
      createdAt: '2026-10-20T10:00:00.000Z',
    });
  });

  it('"sin confirmar" son las activas sin mail confirmado', async () => {
    mockPage([]);
    countDocuments.mockResolvedValue(0);

    await listPlatformUsers({ filter: 'unverified', q: '', page: 1, pageSize: 20 });

    const where = find.mock.calls[0][0] as { $and: object[] };
    expect(where.$and).toContainEqual({ account_status: 'active', email_verified: false });
  });

  it('escapa la búsqueda: un punto o un paréntesis no son un patrón', async () => {
    mockPage([]);
    countDocuments.mockResolvedValue(0);

    await listPlatformUsers({ filter: 'all', q: 'a.(b', page: 1, pageSize: 20 });

    const where = find.mock.calls[0][0] as { $and: Array<{ $or?: Array<{ name: RegExp }> }> };
    const search = where.$and.find((condition) => condition.$or)?.$or?.[0].name;
    expect(search?.source).toBe('a\\.\\(b');
  });

  it('con 0 resultados informa 1 página, no 0', async () => {
    mockPage([]);
    countDocuments.mockResolvedValue(0);

    const page = await listPlatformUsers({ filter: 'all', q: '', page: 1, pageSize: 20 });

    expect(page.pages).toBe(1);
  });
});
