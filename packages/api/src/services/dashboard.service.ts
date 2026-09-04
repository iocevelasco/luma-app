import mongoose from 'mongoose';
import {
  currentWeekKey,
  daysBetween,
  pct,
  round2,
  toDateKey,
  weekRange,
  type ActivityWithContext,
  type ClientDashboard,
  type DashboardSummary,
  type Forecast,
  type ForecastAlert,
} from '@luma/shared';
import { ActivityModel } from '../models/Activity.js';
import { MaterialModel } from '../models/Material.js';
import { AttendanceModel } from '../models/Attendance.js';
import { ContingencyModel } from '../models/Contingency.js';
import { ProjectModel } from '../models/Project.js';
import { computeBudgetStatus } from './budget.service.js';
import { notFound } from '../utils/errors.js';

/**
 * El dashboard responde UNA pregunta: cómo va la obra hoy y qué requiere mi
 * atención (§3). Por eso viene todo en un request: si la pantalla principal
 * necesitara seis llamadas, en la obra —con señal intermitente— cargaría a
 * medias y mostraría un estado inconsistente.
 */
export async function getDashboard(projectId: string, week?: string): Promise<DashboardSummary> {
  const oid = new mongoose.Types.ObjectId(projectId);
  const project = await ProjectModel.findById(oid).lean();
  if (!project) throw notFound('Proyecto no encontrado');

  const targetWeek = week ?? currentWeekKey();
  const today = toDateKey();

  const [activities, materials, attendance, contingencies, budget] = await Promise.all([
    ActivityModel.find({ project_id: oid }).sort({ order: 1, planned_start: 1 }).lean(),
    MaterialModel.find({ project_id: oid }).lean(),
    AttendanceModel.find({ project_id: oid, date: today }).lean(),
    ContingencyModel.find({ project_id: oid }).lean(),
    computeBudgetStatus(projectId),
  ]);

  const now = new Date();
  const totalWeight = activities.reduce((sum, a) => sum + (a.weight || 1), 0);
  const doneWeight = activities
    .filter((a) => a.status === 'done')
    .reduce((sum, a) => sum + (a.weight || 1), 0);
  const progressPct = totalWeight ? pct(doneWeight, totalWeight) : 0;

  const blockingByActivity = new Map<string, number>();
  for (const m of materials) {
    if (m.status !== 'pending' || !m.activity_id) continue;
    const key = m.activity_id.toString();
    blockingByActivity.set(key, (blockingByActivity.get(key) ?? 0) + 1);
  }

  const isLate = (a: (typeof activities)[number]) =>
    a.status !== 'done' && a.planned_end.getTime() < now.getTime();

  const weekActivities: ActivityWithContext[] = activities
    .filter((a) => a.week === targetWeek)
    .map((a) => ({
      id: a._id.toString(),
      project_id: projectId,
      name: a.name,
      area: a.area,
      chapter_code: a.chapter_code,
      planned_start: a.planned_start.toISOString(),
      planned_end: a.planned_end.toISOString(),
      responsible_id: a.responsible_id?.toString() ?? null,
      status: a.status,
      blocked_reason: a.blocked_reason,
      weight: a.weight,
      planned_headcount: a.planned_headcount,
      week: a.week,
      progress_photos: a.progress_photos,
      completed_at: a.completed_at?.toISOString() ?? null,
      order: a.order,
      is_late: isLate(a),
      blocking_materials: blockingByActivity.get(a._id.toString()) ?? 0,
    }));

  const expectedToday = activities
    .filter((a) => a.status === 'in_progress' || a.week === targetWeek)
    .reduce((sum, a) => sum + (a.planned_headcount || 0), 0);
  const presentToday = attendance.filter((r) => r.present).length;

  const awaiting = contingencies.filter((c) => c.status === 'sent_to_client');
  const oldestAwaitingDays = awaiting.length
    ? Math.max(
        ...awaiting.map((c) => daysBetween(c.sent_to_client_at ?? c.createdAt, now)),
      )
    : null;

  const pendingMaterials = materials.filter((m) => m.status === 'pending');

  return {
    project: {
      id: project._id.toString(),
      name: project.name,
      status: project.status,
      currency: project.currency,
    },
    week: targetWeek,
    progress_pct: progressPct,
    activities: {
      total: activities.length,
      done: activities.filter((a) => a.status === 'done').length,
      in_progress: activities.filter((a) => a.status === 'in_progress').length,
      pending: activities.filter((a) => a.status === 'pending').length,
      blocked: activities.filter((a) => a.status === 'blocked').length,
      late: activities.filter(isLate).length,
      this_week: weekActivities,
    },
    materials: {
      pending: pendingMaterials.length,
      blocking: pendingMaterials.filter((m) => !!m.activity_id).length,
      estimated_pending_cost: round2(
        pendingMaterials.reduce((sum, m) => sum + (m.estimated_cost ?? 0), 0),
      ),
    },
    personnel: {
      expected_today: expectedToday,
      present_today: presentToday,
      deficit: Math.max(expectedToday - presentToday, 0),
    },
    budget,
    contingencies: {
      pending_internal: contingencies.filter((c) => c.status === 'pending_internal').length,
      awaiting_client: awaiting.length,
      oldest_awaiting_days: oldestAwaitingDays,
    },
    forecast: buildForecast({
      activities,
      materials,
      budget,
      plannedEnd: project.planned_end_date ?? null,
      startDate: project.start_date ?? null,
      thresholds: project.budget_thresholds,
    }),
  };
}

/**
 * Previsiones (RF-10).
 *
 * Aritmética simple y a propósito: proyectar el cierre presupuestal según el
 * ritmo de ejecución, y la fecha de fin según el avance real contra el
 * planificado. Un modelo más sofisticado sobre datos de un mes de obra daría
 * precisión falsa; lo que el ejecutante necesita es la dirección y la
 * magnitud, no dos decimales.
 */
export function buildForecast(params: {
  activities: Array<{ status: string; weight: number; planned_end: Date }>;
  materials: Array<{ status: string; estimated_cost?: number; name: string }>;
  budget: { baseline: number; executed: number; committed: number; by_chapter: Array<{ name: string; deviation_pct: number }> };
  plannedEnd: Date | null;
  startDate: Date | null;
  thresholds: { warning_pct: number; danger_pct: number };
}): Forecast {
  const { activities, materials, budget, plannedEnd, startDate, thresholds } = params;

  const totalWeight = activities.reduce((s, a) => s + (a.weight || 1), 0);
  const doneWeight = activities
    .filter((a) => a.status === 'done')
    .reduce((s, a) => s + (a.weight || 1), 0);
  const progress = totalWeight ? doneWeight / totalWeight : 0;

  // Cierre proyectado: si con el X% del trabajo hecho ya se gastó Y, a este
  // ritmo el cierre es Y/X. Con avance cero no hay ritmo del que hablar y la
  // proyección es la propia línea base.
  const spent = budget.executed + budget.committed;
  const projectedClose = progress > 0.02 ? round2(spent / progress) : budget.baseline;
  const projectedDeviation = round2(projectedClose - budget.baseline);

  let projectedEnd: Date | null = null;
  let delayDays = 0;
  if (startDate && plannedEnd) {
    const plannedDays = Math.max(daysBetween(startDate, plannedEnd), 1);
    const elapsed = Math.max(daysBetween(startDate, new Date()), 0);
    if (progress > 0.02) {
      const projectedDays = Math.round(elapsed / progress);
      projectedEnd = new Date(startDate.getTime() + projectedDays * 86400000);
      delayDays = Math.max(daysBetween(plannedEnd, projectedEnd), 0);
    } else if (elapsed > plannedDays) {
      projectedEnd = null;
      delayDays = elapsed - plannedDays;
    }
  }

  const alerts: ForecastAlert[] = [];

  const blockingMaterials = materials.filter((m) => m.status === 'pending');
  if (blockingMaterials.length > 0) {
    alerts.push({
      kind: 'material_running_out',
      severity: blockingMaterials.length > 3 ? 'warning' : 'info',
      message: `${blockingMaterials.length} material(es) pendientes de compra pueden frenar actividades.`,
      link: '/materiales',
    });
  }

  const now = Date.now();
  const atRisk = activities.filter(
    (a) => a.status !== 'done' && a.planned_end.getTime() < now + 3 * 86400000,
  );
  if (atRisk.length > 0) {
    alerts.push({
      kind: 'activity_at_risk',
      severity: 'warning',
      message: `${atRisk.length} actividad(es) vencen en los próximos 3 días y no están listas.`,
      link: '/planificacion',
    });
  }

  for (const chapter of budget.by_chapter) {
    if (chapter.deviation_pct >= thresholds.danger_pct) {
      alerts.push({
        kind: 'chapter_deviation',
        severity: 'danger',
        message: `"${chapter.name}" va ${chapter.deviation_pct}% por encima de lo presupuestado.`,
        link: '/presupuesto',
      });
    }
  }

  return {
    projected_budget_close: projectedClose,
    projected_budget_deviation: projectedDeviation,
    projected_end_date: projectedEnd?.toISOString() ?? null,
    planned_end_date: plannedEnd?.toISOString() ?? null,
    projected_delay_days: delayDays,
    alerts,
  };
}

/**
 * Vista del cliente (§2.4 y regla de negocio 4).
 *
 * Se arma en su propia función y no filtrando el dashboard completo: así no
 * hay forma de que un campo nuevo del dashboard interno se filtre al cliente
 * por olvido. Acá adentro sólo entra lo que el cliente puede ver — estado,
 * avance, dinero y decisiones pendientes. Nada de asignación de personal,
 * notas internas ni listas de compras en borrador.
 */
export async function getClientDashboard(projectId: string): Promise<ClientDashboard> {
  const oid = new mongoose.Types.ObjectId(projectId);
  const [project, activities, budget, decisions] = await Promise.all([
    ProjectModel.findById(oid).lean(),
    ActivityModel.find({ project_id: oid }).select({ status: 1, weight: 1 }).lean(),
    computeBudgetStatus(projectId),
    ContingencyModel.find({ project_id: oid, status: 'sent_to_client' })
      .sort({ sent_to_client_at: 1 })
      .lean(),
  ]);
  if (!project) throw notFound('Proyecto no encontrado');

  const totalWeight = activities.reduce((s, a) => s + (a.weight || 1), 0);
  const doneWeight = activities
    .filter((a) => a.status === 'done')
    .reduce((s, a) => s + (a.weight || 1), 0);

  return {
    project: {
      id: project._id.toString(),
      name: project.name,
      status: project.status,
      currency: project.currency,
    },
    progress_pct: totalWeight ? pct(doneWeight, totalWeight) : 0,
    activities_done: activities.filter((a) => a.status === 'done').length,
    activities_total: activities.length,
    budget: {
      currency: budget.currency,
      baseline: budget.baseline,
      committed_total: round2(budget.executed + budget.committed),
      remaining: budget.available,
      health: budget.health,
    },
    pending_decisions: decisions.map((c) => ({
      id: c._id.toString(),
      code: c.code,
      what_happened: c.what_happened,
      why_happened: c.why_happened,
      impact_cost: c.impact_cost,
      impact_days: c.impact_days,
      options: c.options,
      urgency: c.urgency,
      sent_to_client_at: c.sent_to_client_at?.toISOString(),
    })),
    last_summary_at: null,
  };
}

export function weekBounds(week: string) {
  return weekRange(week);
}
