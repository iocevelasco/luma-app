import type { Model } from 'mongoose';
import {
  PROJECT_TRASH_RETENTION_DAYS,
  type DeletedProject,
  type ProjectDeletionSummary,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { Budget } from '../models/Budget.js';
import { BudgetLine } from '../models/BudgetLine.js';
import { CrewGoal } from '../models/CrewGoal.js';
import { CrewMember } from '../models/CrewMember.js';
import { Expense } from '../models/Expense.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { MaterialItem } from '../models/MaterialItem.js';
import { Milestone } from '../models/Milestone.js';
import { Notification } from '../models/Notification.js';
import { Payment } from '../models/Payment.js';
import { PaymentScheduleItem } from '../models/PaymentScheduleItem.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectClient } from '../models/ProjectClient.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { ProjectDocument } from '../models/ProjectDocument.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { Provider } from '../models/Provider.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';
import { deleteObject } from './storage.service.js';
import { previewProjectCreation } from './subscription.service.js';

/**
 * Eliminar una obra es **lógico**: se marca `deletedAt` y se esconde. Nada de
 * lo que cuelga de ella se toca, así que restaurarla devuelve la obra exacta.
 * A los `PROJECT_TRASH_RETENTION_DAYS` días la barre `purge-deleted-projects`,
 * y recién ahí se borra de verdad — con todo lo que tenía, archivos incluidos.
 *
 * Por qué no un TTL index de Mongo: expira el documento de la obra y nada
 * más. Cobros, gastos y archivos quedarían huérfanos para siempre, sin dueño
 * y contando en las consultas que no filtran por obra.
 */

// Modelos de esquemas distintos en una misma lista: no hay un `Model<T>` común.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * TODO lo que referencia una obra con un campo `project`, y cómo se la busca.
 * Hay un test que falla si aparece un modelo con `project` que no esté acá:
 * una colección olvidada es plata o fotos huérfanas después del purgado.
 *
 * `CrewMember` y `Provider` llevan `project` sólo cuando son de UNA obra
 * (`scope: 'project'`); los de la Empresa tienen `project: null` y se
 * comparten, así que no los alcanza este filtro.
 */
export const PROJECT_OWNED: ReadonlyArray<{ model: AnyModel; label: string }> = [
  { model: Budget, label: 'Budget' },
  { model: BudgetLine, label: 'BudgetLine' },
  { model: Payment, label: 'Payment' },
  { model: PaymentScheduleItem, label: 'PaymentScheduleItem' },
  { model: Expense, label: 'Expense' },
  { model: Milestone, label: 'Milestone' },
  { model: ProjectDocument, label: 'ProjectDocument' },
  { model: ProviderEngagement, label: 'ProviderEngagement' },
  { model: ProjectClient, label: 'ProjectClient' },
  { model: ProjectCrewMember, label: 'ProjectCrewMember' },
  { model: ProjectProvider, label: 'ProjectProvider' },
  { model: ProjectMembership, label: 'ProjectMembership' },
  { model: LaborRecord, label: 'LaborRecord' },
  { model: MaterialItem, label: 'MaterialItem' },
  { model: Notification, label: 'Notification' },
  { model: CrewGoal, label: 'CrewGoal' },
  { model: CrewMember, label: 'CrewMember' },
  { model: Provider, label: 'Provider' },
  { model: Activity, label: 'Activity' },
];

/** Dependen de una actividad, no de la obra. Se borran antes que las actividades. */
const ACTIVITY_OWNED: ReadonlyArray<AnyModel> = [ActivityCrew, ActivityProvider];

/** Los modelos que guardan archivos del media-service como `{ key }`. */
const FILE_OWNERS: ReadonlyArray<AnyModel> = [
  Activity,
  Milestone,
  Expense,
  ProjectDocument,
  MaterialItem,
];

export function purgeDateFrom(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + PROJECT_TRASH_RETENTION_DAYS * DAY_MS);
}

/** Lo que se va con la obra, para que quien la elimina lo sepa antes de confirmar. */
export async function summarizeDeletion(project: IProject): Promise<ProjectDeletionSummary> {
  const byProject = { project: project._id };
  const [
    activities,
    materials,
    laborRecords,
    crewMembers,
    providers,
    documents,
    milestones,
    payments,
    expenses,
    members,
  ] = await Promise.all([
    Activity.countDocuments(byProject),
    MaterialItem.countDocuments(byProject),
    LaborRecord.countDocuments(byProject),
    CrewMember.countDocuments(byProject),
    Provider.countDocuments(byProject),
    ProjectDocument.countDocuments(byProject),
    Milestone.countDocuments(byProject),
    Payment.countDocuments(byProject),
    Expense.countDocuments(byProject),
    ProjectMembership.countDocuments(byProject),
  ]);

  // Asignaciones a gente de la Empresa: se sueltan, la persona o el proveedor queda.
  const [ownCrew, ownProviders, crewLinks, providerLinks] = await Promise.all([
    CrewMember.find(byProject).distinct('_id'),
    Provider.find(byProject).distinct('_id'),
    ProjectCrewMember.find(byProject).select('crewMember').lean(),
    ProjectProvider.find(byProject).select('provider').lean(),
  ]);
  const own = (ids: unknown[]) => new Set(ids.map(String));
  const ownCrewIds = own(ownCrew);
  const ownProviderIds = own(ownProviders);

  return {
    projectName: project.name,
    retentionDays: PROJECT_TRASH_RETENTION_DAYS,
    counts: {
      activities,
      materials,
      laborRecords,
      crewMembers,
      providers,
      documents,
      milestones,
      payments,
      expenses,
      members,
    },
    shared: {
      crewMembers: crewLinks.filter((l) => !ownCrewIds.has(String(l.crewMember))).length,
      providers: providerLinks.filter((l) => !ownProviderIds.has(String(l.provider))).length,
    },
    // Quien la creó no tiene fila de membresía: todas las filas son otras personas
    // (los demás gerentes incluidos, que también pierden la obra).
    affectedPeople: members,
    freesSubscriptionSlot: project.status === 'active',
  };
}

/** Manda la obra a la papelera. Idempotente: si ya estaba, no mueve la fecha. */
export async function moveToTrash(project: IProject, userId: string, now = new Date()) {
  return Project.findOneAndUpdate(
    { _id: project._id },
    { $set: { deletedAt: now, deletedBy: userId, purgeAt: purgeDateFrom(now) } },
    { new: true },
  );
}

/** Las obras en la papelera de quien las creó, las más recientes primero. */
export async function listTrash(userId: string, now = new Date()): Promise<DeletedProject[]> {
  const projects = await Project.find({
    createdBy: userId,
    deletedAt: { $ne: null },
    purgeAt: { $gt: now },
  })
    .sort({ deletedAt: -1 })
    .limit(100);

  // Una consulta por Empresa, no por obra.
  const orgs = [...new Set(projects.map((p) => String(p.organization)))];
  const decisions = new Map(
    await Promise.all(
      orgs.map(async (org) => [org, await previewProjectCreation(org, now)] as const),
    ),
  );

  return projects.map((p) => {
    const decision = decisions.get(String(p.organization))!;
    // Una obra archivada no ocupa lugar: restaurarla no se cobra.
    const counts = p.status === 'active';
    return {
      id: String(p._id),
      name: p.name,
      location: p.location,
      deletedAt: (p.deletedAt as Date).toISOString(),
      purgeAt: (p.purgeAt as Date).toISOString(),
      daysLeft: Math.max(0, Math.ceil(((p.purgeAt as Date).getTime() - now.getTime()) / DAY_MS)),
      restore: !counts
        ? { allowed: true, isExtra: false }
        : decision.allowed
          ? { allowed: true, isExtra: decision.isExtra }
          : { allowed: false, isExtra: false, blockedBy: decision.code },
    };
  });
}

/**
 * Las obras en la papelera donde esta persona fue invitada (supervisor,
 * contador, cliente). Mientras la obra está ahí, la membresía sigue viva: es lo
 * que permite avisarles que existió y a quién consultar. Tras el purgado la
 * membresía se borra y el aviso desaparece con ella.
 */
export async function removedProjectsForMember(userId: string, now = new Date()) {
  const memberships = await ProjectMembership.find({ user: userId }).select('project').lean();
  if (memberships.length === 0) return [];

  const removed = await Project.find({
    _id: { $in: memberships.map((m) => m.project) },
    deletedAt: { $ne: null },
    purgeAt: { $gt: now },
  }).select('name');
  return removed.map((p) => ({ id: String(p._id), name: p.name }));
}

/** La obra en la papelera de este gerente que todavía se puede restaurar. */
export async function findRestorable(projectId: string, userId: string, now = new Date()) {
  return Project.findOne({
    _id: projectId,
    createdBy: userId,
    deletedAt: { $ne: null },
    purgeAt: { $gt: now },
  });
}

export async function restoreFromTrash(project: IProject, now = new Date()) {
  return Project.findOneAndUpdate(
    { _id: project._id, deletedAt: { $ne: null } },
    {
      $set: { deletedAt: null, deletedBy: null, purgeAt: null },
      // Queda anotado el tramo en la papelera: la facturación cuenta la obra
      // como nueva desde `to` (ver `billableWindows`).
      $push: { trashedPeriods: { from: project.deletedAt, to: now } },
    },
    { new: true },
  );
}

export interface PurgeRun {
  checked: number;
  purged: number;
  failed: number;
}

/**
 * Borra de verdad las obras cuya papelera venció, con todo lo que tenían.
 * Pensado para correr una vez por día (ver `scripts/purge-deleted-projects.ts`).
 *
 * Los archivos van primero: si el media-service falla, la obra se queda donde
 * está y se reintenta mañana. Al revés, un fallo dejaría fotos y comprobantes
 * sin ninguna fila que las referencie — imposibles de encontrar después.
 */
export async function purgeExpiredProjects(now = new Date()): Promise<PurgeRun> {
  const expired = await Project.find({ deletedAt: { $ne: null }, purgeAt: { $lte: now } });
  const run: PurgeRun = { checked: expired.length, purged: 0, failed: 0 };

  for (const project of expired) {
    try {
      await purgeProject(project);
      run.purged += 1;
    } catch (error) {
      run.failed += 1;
      console.error(`❌ [PURGE] obra ${String(project._id)}:`, error);
    }
  }
  return run;
}

export async function purgeProject(project: IProject): Promise<void> {
  const byProject = { project: project._id };

  // 1. Archivos del media-service.
  for (const model of FILE_OWNERS) {
    const rows = await model.find(byProject).lean();
    for (const key of collectFileKeys(rows)) await deleteObject(key);
  }

  // 2. Lo que cuelga de las actividades, y recién ahí las actividades.
  const activityIds = await Activity.find(byProject).distinct('_id');
  for (const model of ACTIVITY_OWNED) await model.deleteMany({ activity: { $in: activityIds } });

  // 3. Todo lo demás de la obra.
  for (const { model } of PROJECT_OWNED) await model.deleteMany(byProject);

  // 4. La obra, al final: si algo de arriba falló, sigue en la papelera y se reintenta.
  await Project.deleteOne({ _id: project._id, deletedAt: { $ne: null } });
}

/**
 * Cada `key` de archivo que cuelgue de estas filas, a la profundidad que sea:
 * las fotos viven dentro de las actividades, los adjuntos dentro de los hitos.
 * Recorrer en vez de enumerar cada campo hace que un adjunto nuevo se limpie
 * solo.
 */
export function collectFileKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectFileKeys(item, found);
  } else if (value && typeof value === 'object') {
    for (const [field, inner] of Object.entries(value)) {
      if (field === 'key' && typeof inner === 'string') found.push(inner);
      else collectFileKeys(inner, found);
    }
  }
  return found;
}
