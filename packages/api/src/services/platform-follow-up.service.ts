import {
  ACCOUNT_STAGES,
  accountHealth,
  currentStage,
  emptyActionCounts,
  reachedStages,
  type AccountProgressFacts,
  type PlatformAction,
  type PlatformFollowUpFilter,
  type PlatformFollowUpPage,
  type PlatformFollowUpQuery,
  type PlatformFollowUpRow,
  type PlatformFunnel,
  type ProjectRole,
  type SubscriptionStatus,
} from '@luma/shared';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { User } from '../models/User.js';
import { classifyAccounts } from './platform-accounts.service.js';
import { actorActivityStats } from './platform-activity.service.js';
import { weekStartOf } from './platform-users.service.js';

/**
 * Embudo y seguimiento de las cuentas con membresía (`@luma/shared`,
 * `platform-accounts/progress`). Todo se calcula al pedirlo, a partir de las
 * mismas acciones que cuenta Actividad; no se guarda ninguna etapa.
 *
 * Solo cantidades: ni nombres de clientes, ni descripciones, ni montos. Una
 * fila lleva lo que la persona *hizo* (obras, invitados, actividades), no el
 * contenido de lo que cargó.
 *
 * Como las colecciones de donde sale se borran de verdad (ver "Borrados" en
 * `platform-activity.service.ts`), el histórico puede bajar: una cohorte vieja
 * puede mostrar menos conversión que antes si alguien eliminó su obra.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_WEEKS = 6;
const ACTIVE_DAYS = 7;

/** Una cuenta con membresía y todo lo que hace falta para ubicarla. */
export interface MemberProgress {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  emailVerified: boolean;
  status: SubscriptionStatus;
  trialDaysLeft: number | null;
  counts: Record<PlatformAction, number>;
  last: Date | null;
  invitedByRole: Partial<Record<ProjectRole, number>>;
}

export function progressFacts(member: MemberProgress): AccountProgressFacts {
  const { counts } = member;
  return {
    emailVerified: member.emailVerified,
    projects: counts.projectCreated,
    invites: counts.memberInvited,
    planning: counts.activityCreated + counts.budgetImported,
    money: counts.expenseRegistered + counts.paymentRegistered,
  };
}

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

/** Las cuentas con membresía, con su actividad. Tres lecturas en lote más la clasificación. */
export async function loadMemberProgress(now: Date = new Date()): Promise<MemberProgress[]> {
  const members = (await classifyAccounts(now)).filter((account) => account.subscription);
  const ids = members.map((member) => member.id);

  const [users, stats, inviteRows] = await Promise.all([
    User.find({ _id: { $in: ids } })
      .select('name email email_verified')
      .lean(),
    actorActivityStats(),
    ProjectMembership.aggregate<{ _id: { by: unknown; role: ProjectRole }; n: number }>([
      { $group: { _id: { by: '$invitedBy', role: '$role' }, n: { $sum: 1 } } },
    ]),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const invitedBy = new Map<string, Partial<Record<ProjectRole, number>>>();
  for (const row of inviteRows) {
    const key = String(row._id.by);
    invitedBy.set(key, { ...invitedBy.get(key), [row._id.role]: row.n });
  }

  const result: MemberProgress[] = [];
  for (const member of members) {
    const user = userById.get(member.id);
    if (!user || !member.subscription) continue;
    const own = stats.get(member.id);
    result.push({
      id: member.id,
      name: user.name,
      email: user.email,
      createdAt: member.createdAt,
      emailVerified: user.email_verified,
      status: member.subscription.status,
      trialDaysLeft: member.subscription.trialDaysLeft,
      counts: own?.counts ?? emptyActionCounts(),
      last: own?.last ?? null,
      invitedByRole: invitedBy.get(member.id) ?? {},
    });
  }
  return result;
}

/** El embudo y las últimas seis cohortes semanales de alta. Puro. */
export function buildFunnel(members: readonly MemberProgress[], now: Date): PlatformFunnel {
  const stageCounts = ACCOUNT_STAGES.map(() => 0);

  const currentWeek = weekStartOf(now).getTime();
  const cohorts = Array.from({ length: COHORT_WEEKS }, (_, index) => ({
    weekStart: new Date(currentWeek - (COHORT_WEEKS - 1 - index) * 7 * DAY_MS)
      .toISOString()
      .slice(0, 10),
    size: 0,
    reached: ACCOUNT_STAGES.map(() => 0),
  }));
  const cohortByWeek = new Map(cohorts.map((cohort) => [cohort.weekStart, cohort]));

  let active7d = 0;
  for (const member of members) {
    const reached = reachedStages(progressFacts(member)).length;
    for (let i = 0; i < reached; i += 1) stageCounts[i] += 1;

    const cohort = cohortByWeek.get(weekStartOf(member.createdAt).toISOString().slice(0, 10));
    if (cohort) {
      cohort.size += 1;
      for (let i = 0; i < reached; i += 1) cohort.reached[i] += 1;
    }
    if (member.last && now.getTime() - member.last.getTime() < ACTIVE_DAYS * DAY_MS) active7d += 1;
  }

  return {
    stages: ACCOUNT_STAGES.map((stage, index) => ({ stage, count: stageCounts[index] })),
    cohorts,
    active7d,
  };
}

function toRow(member: MemberProgress, now: Date): PlatformFollowUpRow {
  const facts = progressFacts(member);
  const stage = currentStage(facts);
  const health = accountHealth({
    status: member.status,
    stage,
    daysSinceJoined: daysBetween(member.createdAt, now),
    daysSinceLastAction: member.last ? daysBetween(member.last, now) : null,
    trialDaysLeft: member.trialDaysLeft,
  });
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    createdAt: member.createdAt.toISOString(),
    membership: member.status,
    trialDaysLeft: member.trialDaysLeft,
    stage,
    projects: facts.projects,
    invited: facts.invites,
    invitedByRole: member.invitedByRole,
    activities: member.counts.activityCreated,
    lastActionAt: member.last ? member.last.toISOString() : null,
    health: health.key,
    risk: health.risk,
  };
}

const PAYING: readonly SubscriptionStatus[] = ['activa', 'en_revision', 'pago_fallido'];

const FILTERS: Record<PlatformFollowUpFilter, (row: PlatformFollowUpRow) => boolean> = {
  all: () => true,
  risk: (row) => row.risk,
  trial: (row) => row.membership === 'prueba',
  paying: (row) => PAYING.includes(row.membership),
  expired: (row) => row.membership === 'vencida',
};

/**
 * La lista de seguimiento: primero las que necesitan atención, y dentro de cada
 * grupo la más nueva arriba. Se arma entera y se corta después porque el
 * semáforo no es un campo que la base pueda ordenar o filtrar.
 */
export function buildFollowUp(
  members: readonly MemberProgress[],
  query: PlatformFollowUpQuery,
  now: Date,
): PlatformFollowUpPage {
  const text = query.q.toLowerCase();
  const rows = members
    .filter((member) => !text || `${member.name} ${member.email}`.toLowerCase().includes(text))
    .map((member) => toRow(member, now));

  const counts = Object.fromEntries(
    (Object.keys(FILTERS) as PlatformFollowUpFilter[]).map((key) => [
      key,
      rows.filter(FILTERS[key]).length,
    ]),
  ) as Record<PlatformFollowUpFilter, number>;

  const selected = rows
    .filter(FILTERS[query.filter])
    .sort(
      (a, b) =>
        Number(b.risk) - Number(a.risk) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const start = (query.page - 1) * query.pageSize;
  return {
    rows: selected.slice(start, start + query.pageSize),
    total: selected.length,
    page: query.page,
    pageSize: query.pageSize,
    pages: Math.max(1, Math.ceil(selected.length / query.pageSize)),
    counts,
  };
}

export async function platformFunnel(now: Date = new Date()): Promise<PlatformFunnel> {
  return buildFunnel(await loadMemberProgress(now), now);
}

export async function platformFollowUp(
  query: PlatformFollowUpQuery,
  now: Date = new Date(),
): Promise<PlatformFollowUpPage> {
  return buildFollowUp(await loadMemberProgress(now), query, now);
}
