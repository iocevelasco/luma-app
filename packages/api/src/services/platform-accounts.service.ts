import {
  ACCOUNT_SEGMENTS,
  MEMBERSHIP_BUCKETS,
  classifyAccount,
  foldSmallRoles,
  membershipBucket,
  primaryStaffRole,
  type AccountSegment,
  type MembershipBucket,
  type PlatformCensus,
  type ProjectRole,
  type StaffRole,
  type SubscriptionStatus,
} from '@luma/shared';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { User } from '../models/User.js';
import { statesFor } from './subscription.service.js';
import {
  REAL_ACCOUNTS,
  SIGNUP_WEEKS,
  TEST_ACCOUNT,
  weekStartOf,
} from './platform-users.service.js';

/**
 * Qué cuentas importan, y cuántas hay de cada tipo (`@luma/shared`,
 * `platform-accounts`). Todo se calcula al pedirlo: el segmento no se guarda
 * en `User` porque se desactualizaría en cuanto alguien crea su primera obra
 * o se vence una prueba.
 *
 * Las cuentas de prueba (`@luma.test`) no entran: se cuentan aparte.
 */

/** Una cuenta real, ya clasificada. */
export interface ClassifiedAccount {
  id: string;
  segment: AccountSegment;
  /** Solo si tiene membresía. */
  membership: MembershipBucket | null;
  /** Estado de la membresía y días de prueba que le quedan. `null` sin membresía. */
  subscription: { status: SubscriptionStatus; trialDaysLeft: number | null } | null;
  /** Solo si es empleado: el rol con el que cuenta. */
  staffRole: StaffRole | null;
  createdAt: Date;
}

interface OwnState {
  status: SubscriptionStatus;
  trialDaysLeft: number | null;
}

/** La membresía que cuenta de una persona con varias Empresas: la primera iniciada. */
function ownState(states: OwnState[]): OwnState | null {
  if (states.length === 0) return null;
  return states.find((state) => state.status !== 'sin_iniciar') ?? states[0];
}

/**
 * Clasifica a todas las cuentas reales con cuatro lecturas en lote (cuentas,
 * dueños de Empresa, suscripciones y roles de obra), nunca una por cuenta.
 */
export async function classifyAccounts(now: Date = new Date()): Promise<ClassifiedAccount[]> {
  const [users, owners, roleRows] = await Promise.all([
    User.find(REAL_ACCOUNTS).select('account_status createdAt').lean(),
    OrganizationMember.find({ role: 'owner' }).select('user organization').lean(),
    ProjectMembership.aggregate<{ _id: unknown; roles: ProjectRole[] }>([
      { $group: { _id: '$user', roles: { $addToSet: '$role' } } },
    ]),
  ]);

  const states = await statesFor(
    owners.map((owner) => owner.organization),
    now,
  );

  const statesByUser = new Map<string, OwnState[]>();
  for (const owner of owners) {
    const state = states.get(String(owner.organization));
    if (!state) continue;
    const key = String(owner.user);
    statesByUser.set(key, [
      ...(statesByUser.get(key) ?? []),
      { status: state.status, trialDaysLeft: state.trialDaysLeft },
    ]);
  }
  const rolesByUser = new Map(roleRows.map((row) => [String(row._id), row.roles]));

  const accounts: ClassifiedAccount[] = [];
  for (const user of users) {
    const id = String(user._id);
    const own = ownState(statesByUser.get(id) ?? []);
    const subscriptionStatus = own?.status ?? null;
    const projectRoles = rolesByUser.get(id) ?? [];
    const classification = classifyAccount({
      isTest: false,
      active: user.account_status === 'active',
      subscriptionStatus,
      projectRoles,
    });
    // `REAL_ACCOUNTS` ya dejó afuera las de prueba; esto lo deja explícito
    // para el tipo y por si algún día el filtro cambia.
    if (classification === 'test') continue;
    accounts.push({
      id,
      segment: classification,
      membership:
        classification === 'membership' && subscriptionStatus
          ? membershipBucket(subscriptionStatus)
          : null,
      subscription: classification === 'membership' && own ? own : null,
      staffRole: classification === 'staff' ? primaryStaffRole(projectRoles) : null,
      createdAt: user.createdAt,
    });
  }
  return accounts;
}

/** `userId → segmento`, para el listado de cuentas. */
export function segmentsById(accounts: readonly ClassifiedAccount[]): Map<string, AccountSegment> {
  return new Map(accounts.map((account) => [account.id, account.segment]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Arma el censo a partir de las cuentas ya clasificadas. Puro: el "ahora" y las
 * cuentas de prueba los pasa quien llama.
 */
export function buildCensus(
  accounts: readonly ClassifiedAccount[],
  testAccounts: number,
  now: Date,
): PlatformCensus {
  const segments = Object.fromEntries(ACCOUNT_SEGMENTS.map((segment) => [segment, 0])) as Record<
    AccountSegment,
    number
  >;
  const memberships = Object.fromEntries(MEMBERSHIP_BUCKETS.map((bucket) => [bucket, 0])) as Record<
    MembershipBucket,
    number
  >;
  const roleCounts: Partial<Record<StaffRole, number>> = {};

  const currentWeek = weekStartOf(now).getTime();
  const weeks = Array.from({ length: SIGNUP_WEEKS }, (_, index) => {
    const start = new Date(currentWeek - (SIGNUP_WEEKS - 1 - index) * 7 * DAY_MS);
    return { weekStart: start.toISOString().slice(0, 10), members: 0, others: 0 };
  });
  const weekIndex = new Map(weeks.map((week) => [week.weekStart, week]));

  for (const account of accounts) {
    segments[account.segment] += 1;
    if (account.membership) memberships[account.membership] += 1;
    if (account.staffRole) roleCounts[account.staffRole] = (roleCounts[account.staffRole] ?? 0) + 1;

    const week = weekIndex.get(weekStartOf(account.createdAt).toISOString().slice(0, 10));
    if (week) {
      if (account.segment === 'membership') week.members += 1;
      else week.others += 1;
    }
  }

  return {
    total: accounts.length,
    segments,
    testAccounts,
    memberships,
    staffRoles: foldSmallRoles(roleCounts),
    signups: weeks,
  };
}

export async function platformCensus(now: Date = new Date()): Promise<PlatformCensus> {
  const [accounts, testAccounts] = await Promise.all([
    classifyAccounts(now),
    User.countDocuments({ email: TEST_ACCOUNT }),
  ]);
  return buildCensus(accounts, testAccounts, now);
}
