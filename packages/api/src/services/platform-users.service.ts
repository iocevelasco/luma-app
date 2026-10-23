import type { FilterQuery } from 'mongoose';
import type {
  PlatformSignupWeek,
  PlatformUserRow,
  PlatformUsersFilter,
  PlatformUsersOverview,
  PlatformUsersPage,
  PlatformUsersQuery,
} from '@luma/shared';
import { User, type IUser } from '../models/User.js';

/** Cuántas semanas muestra la curva de altas, la actual incluida. */
export const SIGNUP_WEEKS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Las cuentas de prueba (E2E, seed) no son gente: si entraran en las cifras,
 * cada tanda de tests inflaría "altas" y "sin confirmar".
 */
const TEST_ACCOUNT = /@luma\.test$/i;
const REAL_ACCOUNTS: FilterQuery<IUser> = { email: { $not: TEST_ACCOUNT } };

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** El lunes (00:00 UTC) de la semana en la que cae `date`. */
export function weekStartOf(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(midnight - sinceMonday * DAY_MS);
}

/**
 * Cuenta altas por semana. Devuelve siempre `weeks` filas, de la más vieja a la
 * actual, con 0 en las semanas sin altas: una curva con huecos miente sobre la
 * escala del eje.
 */
export function bucketSignups(
  createdAts: Date[],
  now: Date,
  weeks: number = SIGNUP_WEEKS,
): PlatformSignupWeek[] {
  const currentWeek = weekStartOf(now).getTime();
  const rows: PlatformSignupWeek[] = [];
  const index = new Map<string, PlatformSignupWeek>();

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const row = { weekStart: dayKey(new Date(currentWeek - i * 7 * DAY_MS)), count: 0 };
    rows.push(row);
    index.set(row.weekStart, row);
  }
  for (const createdAt of createdAts) {
    const row = index.get(dayKey(weekStartOf(createdAt)));
    if (row) row.count += 1;
  }
  return rows;
}

export async function platformUsersOverview(now: Date = new Date()): Promise<PlatformUsersOverview> {
  const since = new Date(
    weekStartOf(now).getTime() - (SIGNUP_WEEKS - 1) * 7 * DAY_MS,
  );

  const [total, active, verified, recent] = await Promise.all([
    User.countDocuments(REAL_ACCOUNTS),
    User.countDocuments({ ...REAL_ACCOUNTS, account_status: 'active' }),
    User.countDocuments({ ...REAL_ACCOUNTS, account_status: 'active', email_verified: true }),
    User.find({ ...REAL_ACCOUNTS, createdAt: { $gte: since } })
      .select('createdAt')
      .lean(),
  ]);

  return {
    stats: {
      total,
      active,
      inactive: total - active,
      verified,
      unverified: active - verified,
    },
    signups: bucketSignups(
      recent.map((user) => user.createdAt),
      now,
    ),
  };
}

function filterQuery(filter: PlatformUsersFilter): FilterQuery<IUser> {
  switch (filter) {
    case 'active':
      return { account_status: 'active' };
    case 'inactive':
      return { account_status: 'inactive' };
    case 'unverified':
      return { account_status: 'active', email_verified: false };
    default:
      return {};
  }
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toRow(user: IUser): PlatformUserRow {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.email_verified,
    accountStatus: user.account_status,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listPlatformUsers(query: PlatformUsersQuery): Promise<PlatformUsersPage> {
  const conditions: FilterQuery<IUser>[] = [REAL_ACCOUNTS, filterQuery(query.filter)];
  if (query.q) {
    const text = new RegExp(escapeRegex(query.q), 'i');
    conditions.push({ $or: [{ name: text }, { email: text }] });
  }
  const where: FilterQuery<IUser> = { $and: conditions };

  const [total, users] = await Promise.all([
    User.countDocuments(where),
    User.find(where)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize),
  ]);

  return {
    users: users.map(toRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
