import mongoose, { type PipelineStage } from 'mongoose';
import {
  ACTIVITY_PERIODS,
  ACTIVITY_ROLE_GROUPS,
  MIN_PEOPLE_PER_CELL,
  emptyActionCounts,
  toCell,
  type ActivityPeriod,
  type ActivityRoleGroup,
  type PlatformAction,
  type PlatformActivityReport,
  type PlatformActivityRole,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { Budget } from '../models/Budget.js';
import { Expense } from '../models/Expense.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { MaterialItem } from '../models/MaterialItem.js';
import { Milestone } from '../models/Milestone.js';
import { Payment } from '../models/Payment.js';
import { Project } from '../models/Project.js';
import { ProjectDocument } from '../models/ProjectDocument.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';
import { User } from '../models/User.js';

/**
 * Cuánta actividad hay por rol de obra, para el admin de la plataforma.
 * Capa A: todo se deriva de colecciones que ya existen y se calcula al
 * consultar; no se guarda nada.
 *
 * **Qué cuenta como "rol".** El de la persona *en la obra donde hizo la
 * acción*: gerente si es `Project.createdBy`, si no el rol de su
 * `ProjectMembership`, si no `exMiembro`. La misma persona puede aparecer en
 * dos roles (gerente en una obra, supervisor en otra) y cuenta una vez en cada
 * uno.
 *
 * **Confidencialidad.** La respuesta lleva sólo conteos por rol, acción y
 * período: ni ids, ni nombres de obras, ni montos, ni textos. Un rol/período
 * con menos de `MIN_PEOPLE_PER_CELL` personas distintas sale con todo en
 * `null` (`toCell`). Las cuentas `@luma.test` no entran.
 *
 * **Borrados.** Estas colecciones se borran de verdad (hard delete):
 * `Activity` (y con ella sus evidencias y reportes/aprobaciones),
 * `Milestone`, `ProjectDocument`, `MaterialItem`, `Payment`, `Expense`,
 * `ProviderEngagement` y `ProjectMembership` (al revocar una invitación). Si
 * alguien borra algo, el conteo histórico baja solo; "desde siempre" es "lo
 * que sigue existiendo". `LaborRecord` y `Budget` no se borran
 * individualmente. Además `Activity.review` guarda sólo el ciclo vigente: un
 * reporte o aprobación de un ciclo anterior ya fue pisado. Y un parte de
 * jornada se cuenta una vez, por su fecha de alta, aunque se edite después.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<Exclude<ActivityPeriod, 'all'>, number> = { '7d': 7, '30d': 30 };

const TEST_ACCOUNT = /@luma\.test$/i;

/** Un autor en una obra, con cuántas veces hizo una acción en cada período. */
export interface ActionGroup {
  action: PlatformAction;
  project: string;
  actor: string;
  counts: Record<ActivityPeriod, number>;
}

interface Source {
  action: PlatformAction;
  model: mongoose.Model<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Campo del autor. */
  actor: string;
  /** Campo de la fecha en que ocurrió. */
  at: string;
  /** Campo de la obra; en `Project` es el propio `_id`. */
  project?: string;
  match?: Record<string, unknown>;
  unwind?: string;
}

const present = (field: string) => ({ [field]: { $ne: null, $exists: true } });

const SOURCES: Source[] = [
  { action: 'projectCreated', model: Project, actor: 'createdBy', at: 'createdAt', project: '_id' },
  { action: 'activityCreated', model: Activity, actor: 'createdBy', at: 'createdAt' },
  {
    action: 'activityApproved',
    model: Activity,
    actor: 'review.approvedBy',
    at: 'review.approvedAt',
    match: { ...present('review.approvedBy'), ...present('review.approvedAt') },
  },
  {
    action: 'activityRejected',
    model: Activity,
    actor: 'review.rejectedBy',
    at: 'review.rejectedAt',
    match: { ...present('review.rejectedBy'), ...present('review.rejectedAt') },
  },
  { action: 'memberInvited', model: ProjectMembership, actor: 'invitedBy', at: 'createdAt' },
  { action: 'budgetImported', model: Budget, actor: 'importedBy', at: 'importedAt' },
  {
    action: 'milestonePublished',
    model: Milestone,
    actor: 'reportedBy',
    at: 'createdAt',
    match: { audience: 'cliente' },
  },
  { action: 'documentUploaded', model: ProjectDocument, actor: 'uploadedBy', at: 'createdAt' },
  { action: 'engagementCreated', model: ProviderEngagement, actor: 'createdBy', at: 'createdAt' },
  {
    action: 'progressReported',
    model: Activity,
    actor: 'review.reportedBy',
    at: 'review.reportedAt',
    match: { ...present('review.reportedBy'), ...present('review.reportedAt') },
  },
  {
    action: 'evidenceUploaded',
    model: Activity,
    actor: 'evidence.uploadedBy',
    at: 'evidence.uploadedAt',
    unwind: '$evidence',
  },
  { action: 'laborLogged', model: LaborRecord, actor: 'createdBy', at: 'createdAt' },
  { action: 'materialRequested', model: MaterialItem, actor: 'createdBy', at: 'createdAt' },
  { action: 'expenseRegistered', model: Expense, actor: 'registeredBy', at: 'createdAt' },
  { action: 'paymentRegistered', model: Payment, actor: 'registeredBy', at: 'createdAt' },
];

function pipeline(source: Source, cutoffs: Record<'7d' | '30d', Date>): PipelineStage[] {
  const within = (cutoff: Date) => ({
    $sum: { $cond: [{ $gte: [`$${source.at}`, cutoff] }, 1, 0] },
  });
  return [
    ...(source.match ? [{ $match: source.match } as PipelineStage] : []),
    ...(source.unwind ? [{ $unwind: source.unwind } as PipelineStage] : []),
    {
      $group: {
        _id: { project: `$${source.project ?? 'project'}`, actor: `$${source.actor}` },
        d7: within(cutoffs['7d']),
        d30: within(cutoffs['30d']),
        all: { $sum: 1 },
      },
    },
  ];
}

async function collectGroups(now: Date): Promise<ActionGroup[]> {
  const cutoffs = {
    '7d': new Date(now.getTime() - PERIOD_DAYS['7d'] * DAY_MS),
    '30d': new Date(now.getTime() - PERIOD_DAYS['30d'] * DAY_MS),
  };
  const results = await Promise.all(
    SOURCES.map((source) => source.model.aggregate(pipeline(source, cutoffs))),
  );
  return results.flatMap((rows, index) =>
    (rows as { _id: { project: unknown; actor: unknown }; d7: number; d30: number; all: number }[])
      .filter((row) => row._id.project && row._id.actor)
      .map((row) => ({
        action: SOURCES[index].action,
        project: String(row._id.project),
        actor: String(row._id.actor),
        counts: { '7d': row.d7, '30d': row.d30, all: row.all },
      })),
  );
}

/** Lo que hace falta para decidir el rol de cada (obra, persona), traído en lote. */
export interface RoleFacts {
  /** obra → dueña (`Project.createdBy`). */
  owners: Map<string, string>;
  /** `obra:persona` → rol de su membresía. */
  memberships: Map<string, string>;
  /** personas que no cuentan (cuentas de prueba). */
  excluded: Set<string>;
}

export function resolveRole(project: string, actor: string, facts: RoleFacts): ActivityRoleGroup {
  if (facts.owners.get(project) === actor) return 'gerente';
  const role = facts.memberships.get(`${project}:${actor}`);
  if (role === 'supervisor' || role === 'contador' || role === 'cliente') return role;
  return 'exMiembro';
}

async function loadRoleFacts(groups: ActionGroup[]): Promise<RoleFacts> {
  const projectIds = [...new Set(groups.map((g) => g.project))];
  const actorIds = [...new Set(groups.map((g) => g.actor))];

  const [projects, memberships, testUsers] = await Promise.all([
    Project.find({ _id: { $in: projectIds } }).select('createdBy').lean(),
    ProjectMembership.find({ project: { $in: projectIds }, user: { $in: actorIds } })
      .select('project user role')
      .lean(),
    User.find({ _id: { $in: actorIds }, email: TEST_ACCOUNT }).select('_id').lean(),
  ]);

  return {
    owners: new Map(projects.map((p) => [String(p._id), String(p.createdBy)])),
    memberships: new Map(memberships.map((m) => [`${m.project}:${m.user}`, m.role])),
    excluded: new Set(testUsers.map((u) => String(u._id))),
  };
}

/**
 * Pura: de los conteos crudos y los roles resueltos al reporte que sale a la
 * red, con la supresión de celdas chicas ya aplicada.
 */
export function buildActivityReport(
  groups: ActionGroup[],
  facts: RoleFacts,
  min: number = MIN_PEOPLE_PER_CELL,
): PlatformActivityReport {
  type Bucket = { actions: Record<PlatformAction, number>; people: Set<string> };
  const buckets = new Map<string, Bucket>();
  const bucketOf = (role: ActivityRoleGroup, period: ActivityPeriod) => {
    const key = `${role}:${period}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { actions: emptyActionCounts(), people: new Set() };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const group of groups) {
    if (facts.excluded.has(group.actor)) continue;
    const role = resolveRole(group.project, group.actor, facts);
    for (const period of ACTIVITY_PERIODS) {
      const count = group.counts[period];
      if (count <= 0) continue;
      const bucket = bucketOf(role, period);
      bucket.actions[group.action] += count;
      bucket.people.add(group.actor);
    }
  }

  const roles: PlatformActivityRole[] = ACTIVITY_ROLE_GROUPS.map((role) => {
    // El cliente es sólo lectura: aunque hubiera filas suyas, no hay cifras
    // que mostrar en esta capa.
    if (role === 'cliente') return { role, readOnly: true, periods: null };
    const periods = Object.fromEntries(
      ACTIVITY_PERIODS.map((period) => {
        const bucket = buckets.get(`${role}:${period}`);
        return [period, toCell(bucket?.people.size ?? 0, bucket?.actions ?? emptyActionCounts(), min)];
      }),
    ) as PlatformActivityRole['periods'];
    return { role, readOnly: false, periods };
  });

  return { minPeople: min, roles };
}

export async function platformActivityReport(
  now: Date = new Date(),
): Promise<PlatformActivityReport> {
  const groups = await collectGroups(now);
  const facts = await loadRoleFacts(groups);
  return buildActivityReport(groups, facts);
}
