import mongoose from 'mongoose';
import {
  contingencyCode,
  formatCurrency,
  type ContingencyStatus,
  type CreateContingencyInput,
} from '@luma/shared';
import { ContingencyModel, type ContingencyDocument } from '../models/Contingency.js';
import { ProjectModel } from '../models/Project.js';
import { ActivityModel } from '../models/Activity.js';
import { UserModel } from '../models/User.js';
import { computeBudgetStatus } from './budget.service.js';
import { EmailService } from './email.service.js';
import { notify, recipientsByRole } from './notification.service.js';
import { audit } from './audit.service.js';
import { badRequest, notFound } from '../utils/errors.js';
import { SERVER_CONFIG } from '../config/app.config.js';

/**
 * El flujo del RF-08, entero y en un solo lugar.
 *
 * La máquina de estados es explícita porque el orden ES el producto: ningún
 * imprevisto llega al cliente sin pasar por la curaduría interna (regla de
 * negocio 1), y ninguna cifra se comunica sin causa (regla 2). Si las
 * transiciones vivieran repartidas entre controladores, la primera prisa se
 * saltearía un paso.
 */
const ALLOWED_TRANSITIONS: Record<ContingencyStatus, ContingencyStatus[]> = {
  draft: ['pending_internal', 'cancelled'],
  pending_internal: ['internal_approved', 'draft', 'cancelled'],
  internal_approved: ['sent_to_client', 'cancelled'],
  sent_to_client: ['client_approved', 'client_rejected', 'alternative_requested'],
  client_approved: [],
  client_rejected: [],
  alternative_requested: ['draft', 'pending_internal', 'cancelled'],
  cancelled: [],
};

function assertTransition(from: ContingencyStatus, to: ContingencyStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw badRequest(
      `Un imprevisto en "${from}" no puede pasar a "${to}".`,
      'INVALID_TRANSITION',
    );
  }
}

async function pushHistory(
  doc: ContingencyDocument,
  to: ContingencyStatus,
  userId: string,
  comment?: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select({ name: 1, email: 1 }).lean();
  doc.history.push({
    at: new Date().toISOString(),
    by: userId,
    by_name: user?.name ?? user?.email,
    from_status: doc.status,
    to_status: to,
    comment,
  });
  doc.status = to;
}

export async function createContingency(params: {
  projectId: string;
  userId: string;
  input: CreateContingencyInput;
  submit: boolean;
}): Promise<ContingencyDocument> {
  const projectOid = new mongoose.Types.ObjectId(params.projectId);

  // findOneAndUpdate con $inc: el correlativo se reserva de forma atómica. Con
  // un count() previo, dos asistentes cargando a la vez sacaban el mismo IMP-007.
  const project = await ProjectModel.findOneAndUpdate(
    { _id: projectOid },
    { $inc: { contingency_seq: 1 } },
    { new: true },
  );
  if (!project) throw notFound('Proyecto no encontrado');

  const doc = new ContingencyModel({
    project_id: projectOid,
    code: contingencyCode(project.contingency_seq),
    ...params.input,
    affected_activity_ids: params.input.affected_activity_ids.map(
      (id) => new mongoose.Types.ObjectId(id),
    ),
    blocking_since: params.input.urgency === 'blocking' ? new Date() : null,
    status: 'draft',
    created_by: new mongoose.Types.ObjectId(params.userId),
  });

  doc.history.push({
    at: new Date().toISOString(),
    by: params.userId,
    from_status: null,
    to_status: 'draft',
  });

  if (params.submit) {
    assertTransition('draft', 'pending_internal');
    await pushHistory(doc, 'pending_internal', params.userId);
  }

  await doc.save();

  if (params.submit) {
    const approvers = await recipientsByRole(params.projectId, ['executor', 'manager']);
    await notify({
      projectId: params.projectId,
      userIds: approvers.map((a) => a.userId),
      type: 'contingency_pending_internal',
      title: `${doc.code} espera tu revisión`,
      body: doc.what_happened,
      link: `/imprevistos/${doc._id.toString()}`,
      urgent: doc.urgency === 'blocking',
      batchKey: `${params.projectId}:pending_internal`,
    });
  }

  await audit({
    projectId: params.projectId,
    userId: params.userId,
    action: 'contingency.create',
    entity: 'Contingency',
    entityId: doc._id.toString(),
    summary: `Se registró el imprevisto ${doc.code} por ${doc.impact_cost}`,
  });

  return doc;
}

/** Paso 2 del RF-08: el encargado ajusta cifras y aprueba internamente. */
export async function approveInternally(params: {
  projectId: string;
  contingencyId: string;
  userId: string;
  impactCost?: number;
  impactDays?: number;
  comment?: string;
}): Promise<ContingencyDocument> {
  const doc = await ContingencyModel.findOne({
    _id: params.contingencyId,
    project_id: new mongoose.Types.ObjectId(params.projectId),
  });
  if (!doc) throw notFound('Imprevisto no encontrado');

  assertTransition(doc.status, 'internal_approved');

  if (params.impactCost !== undefined) doc.impact_cost = params.impactCost;
  if (params.impactDays !== undefined) doc.impact_days = params.impactDays;
  doc.internal_approved_by = new mongoose.Types.ObjectId(params.userId);
  doc.internal_approved_at = new Date();
  await pushHistory(doc, 'internal_approved', params.userId, params.comment);
  await doc.save();

  await audit({
    projectId: params.projectId,
    userId: params.userId,
    action: 'contingency.approve_internal',
    entity: 'Contingency',
    entityId: doc._id.toString(),
    summary: `${doc.code} aprobado internamente por ${doc.impact_cost}`,
  });

  return doc;
}

/**
 * Paso 3: se comunica al cliente.
 *
 * El email nunca lleva la cifra sola: se arma con el total del presupuesto y
 * el saldo que quedaría, porque "todo sobrecosto se muestra contra el
 * presupuesto total y el margen restante, nunca como cifra aislada" (RF-09).
 */
export async function sendToClient(params: {
  projectId: string;
  contingencyId: string;
  userId: string;
}): Promise<ContingencyDocument> {
  const doc = await ContingencyModel.findOne({
    _id: params.contingencyId,
    project_id: new mongoose.Types.ObjectId(params.projectId),
  });
  if (!doc) throw notFound('Imprevisto no encontrado');

  assertTransition(doc.status, 'sent_to_client');

  const [project, budget, clients] = await Promise.all([
    ProjectModel.findById(params.projectId).lean(),
    computeBudgetStatus(params.projectId),
    recipientsByRole(params.projectId, ['client']),
  ]);
  if (!project) throw notFound('Proyecto no encontrado');

  doc.sent_to_client_at = new Date();
  await pushHistory(doc, 'sent_to_client', params.userId);
  await doc.save();

  const link = `${SERVER_CONFIG.APP_URL.replace(/\/$/, '')}/cliente/decisiones/${doc._id.toString()}`;
  const money = (n: number) => formatCurrency(n, budget.currency);

  await Promise.all(
    clients.map((client) =>
      EmailService.sendContingencyToClient(client.email, {
        projectName: project.name,
        code: doc.code,
        what: doc.what_happened,
        why: doc.why_happened,
        impactCost: money(doc.impact_cost),
        impactDays: doc.impact_days,
        budgetTotal: money(budget.baseline),
        remaining: money(Math.max(budget.available - doc.impact_cost, 0)),
        link,
        options: doc.options.map((o) => ({ description: o.description, cost: money(o.cost) })),
      }),
    ),
  );

  await notify({
    projectId: params.projectId,
    userIds: clients.map((c) => c.userId),
    type: 'contingency_awaiting_client',
    title: `${doc.code}: necesitamos tu decisión`,
    body: doc.what_happened,
    link: `/cliente/decisiones/${doc._id.toString()}`,
    urgent: doc.urgency === 'blocking',
    batchKey: `${params.projectId}:awaiting_client`,
  });

  return doc;
}

/**
 * Paso 4 y 5: el cliente decide y, si aprueba, el cronograma se actualiza solo.
 *
 * "Al aprobar, el presupuesto, el cronograma y las actividades afectadas se
 * actualizan sin intervención manual" (RF-08 paso 5). El presupuesto no
 * necesita escritura: `computeBudgetStatus` ya cuenta los imprevistos
 * aprobados como comprometidos. El cronograma sí: hay que correr las fechas.
 */
export async function recordClientDecision(params: {
  projectId: string;
  contingencyId: string;
  userId: string;
  decision: 'approved' | 'rejected' | 'alternative';
  comment?: string;
  chosenOption?: number;
}): Promise<ContingencyDocument> {
  const doc = await ContingencyModel.findOne({
    _id: params.contingencyId,
    project_id: new mongoose.Types.ObjectId(params.projectId),
  });
  if (!doc) throw notFound('Imprevisto no encontrado');

  const target: ContingencyStatus =
    params.decision === 'approved'
      ? 'client_approved'
      : params.decision === 'rejected'
        ? 'client_rejected'
        : 'alternative_requested';

  assertTransition(doc.status, target);

  const user = await UserModel.findById(params.userId).select({ name: 1, email: 1 }).lean();

  if (params.decision === 'approved' && params.chosenOption !== undefined) {
    const option = doc.options[params.chosenOption];
    if (option) {
      doc.impact_cost = option.cost;
      doc.impact_days = option.days;
    }
  }

  doc.client_decision = {
    by: new mongoose.Types.ObjectId(params.userId),
    by_name: user?.name ?? user?.email,
    at: new Date(),
    decision: params.decision,
    comment: params.comment,
    chosen_option: params.chosenOption,
  };
  await pushHistory(doc, target, params.userId, params.comment);
  await doc.save();

  if (params.decision === 'approved' && doc.impact_days > 0) {
    await shiftAffectedActivities(doc);
  }

  const team = await recipientsByRole(params.projectId, ['executor', 'manager', 'assistant']);
  await notify({
    projectId: params.projectId,
    userIds: team.map((t) => t.userId),
    type: 'contingency_decided',
    title: `${doc.code}: el cliente respondió`,
    body:
      params.decision === 'approved'
        ? 'Aprobado. El cronograma ya se actualizó.'
        : params.decision === 'rejected'
          ? 'Rechazado.'
          : `Pidió una alternativa: ${params.comment ?? ''}`,
    link: `/imprevistos/${doc._id.toString()}`,
    urgent: true,
  });

  await audit({
    projectId: params.projectId,
    userId: params.userId,
    action: `contingency.client_${params.decision}`,
    entity: 'Contingency',
    entityId: doc._id.toString(),
    summary: `El cliente ${params.decision} ${doc.code}`,
  });

  return doc;
}

/** Corre las fechas de las actividades afectadas y de todo lo que viene después. */
async function shiftAffectedActivities(doc: ContingencyDocument): Promise<void> {
  if (doc.affected_activity_ids.length === 0) return;

  const affected = await ActivityModel.find({ _id: { $in: doc.affected_activity_ids } }).lean();
  if (affected.length === 0) return;

  const earliestStart = affected
    .map((a) => a.planned_start.getTime())
    .reduce((min, t) => Math.min(min, t), Infinity);

  const shiftMs = doc.impact_days * 86400000;

  // Se corre TODO lo que empieza a partir de la actividad afectada más
  // temprana, no sólo las afectadas: si un retraso empuja la instalación, lo
  // que venía después también se corre. Si no, el cronograma queda mintiendo.
  await ActivityModel.updateMany(
    {
      project_id: doc.project_id,
      status: { $ne: 'done' },
      planned_start: { $gte: new Date(earliestStart) },
    },
    [
      {
        $set: {
          planned_start: { $add: ['$planned_start', shiftMs] },
          planned_end: { $add: ['$planned_end', shiftMs] },
        },
      },
    ],
  );

  // La semana denormalizada quedó vieja después de correr las fechas.
  await recomputeWeeks(doc.project_id.toString());
}

async function recomputeWeeks(projectId: string): Promise<void> {
  const { isoWeekKey } = await import('@luma/shared');
  const activities = await ActivityModel.find({
    project_id: new mongoose.Types.ObjectId(projectId),
  })
    .select({ planned_start: 1, week: 1 })
    .lean();

  const ops = activities
    .map((a) => ({ id: a._id, week: isoWeekKey(a.planned_start) }))
    .filter((a, i) => a.week !== activities[i].week)
    .map((a) => ({ updateOne: { filter: { _id: a.id }, update: { week: a.week } } }));

  if (ops.length > 0) await ActivityModel.bulkWrite(ops);
}
