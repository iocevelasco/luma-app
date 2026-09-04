import cron from 'node-cron';
import mongoose from 'mongoose';
import { currentWeekKey, formatCurrency, toDateKey } from '@luma/shared';
import { ProjectModel } from '../models/Project.js';
import { NotificationModel } from '../models/Notification.js';
import { ActivityModel } from '../models/Activity.js';
import { MaterialModel } from '../models/Material.js';
import { UserModel } from '../models/User.js';
import { EmailService } from './email.service.js';
import { notify, recipientsByRole } from './notification.service.js';
import { getDashboard } from './dashboard.service.js';
import { SERVER_CONFIG } from '../config/app.config.js';

/**
 * Tareas periódicas.
 *
 * Tres, y cada una responde a un requisito escrito:
 *  - despachar lo que quedó esperando la ventana horaria (RF-09).
 *  - alertar temprano en vez de reportar tarde (RF-09, "sin sorpresas").
 *  - resumen semanal para el cliente (§5.4).
 */
export class SchedulerService {
  private static tasks: cron.ScheduledTask[] = [];

  static start(): void {
    // Cada 15 minutos: manda los emails que estaban esperando que abriera la
    // ventana de notificación del proyecto.
    this.tasks.push(cron.schedule('*/15 * * * *', () => void this.flushPendingNotifications()));

    // Todas las mañanas: material que bloquea, actividades atrasadas.
    this.tasks.push(cron.schedule('0 8 * * *', () => void this.earlyWarnings()));

    // Viernes a la tarde: resumen semanal.
    this.tasks.push(cron.schedule('0 17 * * 5', () => void this.weeklySummaries()));

    console.log('⏰ [SCHEDULER] 3 tareas programadas');
  }

  static stop(): void {
    this.tasks.forEach((t) => t.stop());
    this.tasks = [];
  }

  /** Notificaciones creadas fuera de la ventana horaria del proyecto. */
  static async flushPendingNotifications(): Promise<void> {
    const pending = await NotificationModel.find({ sent_at: null })
      .limit(500)
      .lean();
    if (pending.length === 0) return;

    const projects = await ProjectModel.find({
      _id: { $in: [...new Set(pending.map((n) => n.project_id.toString()))] },
    }).lean();
    const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();

    const dueIds: mongoose.Types.ObjectId[] = [];
    for (const notification of pending) {
      const project = projectById.get(notification.project_id.toString());
      if (!project) continue;
      const [sh, sm] = project.notification_window.start.split(':').map(Number);
      const [eh, em] = project.notification_window.end.split(':').map(Number);
      if (minutes >= sh * 60 + sm && minutes <= eh * 60 + em) dueIds.push(notification._id);
    }

    if (dueIds.length > 0) {
      await NotificationModel.updateMany({ _id: { $in: dueIds } }, { sent_at: now });
      console.log(`📨 [SCHEDULER] ${dueIds.length} notificación(es) despachadas`);
    }
  }

  /**
   * Alerta temprana de riesgo antes que reporte tardío del hecho consumado
   * (RF-09). Se agrupa en una sola notificación por proyecto: cinco avisos
   * sueltos a las ocho de la mañana son cinco motivos para silenciar la app.
   */
  static async earlyWarnings(): Promise<void> {
    const projects = await ProjectModel.find({ status: 'active', archived: false }).lean();
    const today = new Date();
    const inThreeDays = new Date(today.getTime() + 3 * 86400000);

    for (const project of projects) {
      const projectId = project._id.toString();

      const [lateActivities, atRisk, blockingMaterials] = await Promise.all([
        ActivityModel.countDocuments({
          project_id: project._id,
          status: { $ne: 'done' },
          planned_end: { $lt: today },
        }),
        ActivityModel.countDocuments({
          project_id: project._id,
          status: { $in: ['pending', 'blocked'] },
          planned_start: { $lte: inThreeDays, $gte: today },
        }),
        MaterialModel.countDocuments({
          project_id: project._id,
          status: 'pending',
          activity_id: { $ne: null },
        }),
      ]);

      if (lateActivities === 0 && atRisk === 0 && blockingMaterials === 0) continue;

      const parts: string[] = [];
      if (blockingMaterials) parts.push(`${blockingMaterials} material(es) frenan actividades`);
      if (lateActivities) parts.push(`${lateActivities} actividad(es) atrasadas`);
      if (atRisk) parts.push(`${atRisk} arrancan en los próximos 3 días`);

      const team = await recipientsByRole(projectId, ['executor', 'manager', 'assistant']);
      await notify({
        projectId,
        userIds: team.map((t) => t.userId),
        type: 'activity_late',
        title: `${project.name}: revisá esto hoy`,
        body: parts.join(' · '),
        link: '/planificacion',
        batchKey: `${projectId}:early_warnings:${toDateKey()}`,
      });
    }
  }

  /**
   * Resumen semanal al cliente (§5.4, §5.5).
   *
   * Se genera como BORRADOR de notificación interna, no se manda solo al
   * cliente: "ninguna respuesta del asistente se envía automáticamente al
   * cliente: siempre pasa por revisión del encargado" (RF-06). El mismo
   * criterio aplica al resumen.
   */
  static async weeklySummaries(): Promise<void> {
    const projects = await ProjectModel.find({ status: 'active', archived: false }).lean();

    for (const project of projects) {
      const projectId = project._id.toString();
      try {
        const dashboard = await getDashboard(projectId, currentWeekKey());
        const money = (n: number) => formatCurrency(n, dashboard.budget.currency);

        const team = await recipientsByRole(projectId, ['executor', 'manager']);
        await notify({
          projectId,
          userIds: team.map((t) => t.userId),
          type: 'weekly_summary',
          title: `Resumen de la semana listo — ${project.name}`,
          body:
            `Avance ${dashboard.progress_pct}% · ${dashboard.activities.done}/${dashboard.activities.total} actividades · ` +
            `disponible ${money(dashboard.budget.available)}. Revisalo antes de enviarlo al cliente.`,
          link: '/resumen-semanal',
        });

        const owner = await UserModel.findById(project.owner_id).select({ email: 1 }).lean();
        if (owner) {
          await EmailService.sendWeeklySummary(
            owner.email,
            project.name,
            `<p>Avance general: <strong>${dashboard.progress_pct}%</strong></p>
             <p>Actividades listas: ${dashboard.activities.done} de ${dashboard.activities.total}` +
              (dashboard.activities.late ? ` (${dashboard.activities.late} atrasadas)` : '') +
              `</p>
             <p>Presupuesto disponible: <strong>${money(dashboard.budget.available)}</strong> sobre ${money(dashboard.budget.baseline)}</p>
             <p>Imprevistos esperando al cliente: ${dashboard.contingencies.awaiting_client}</p>`,
            `${SERVER_CONFIG.APP_URL.replace(/\/$/, '')}/resumen-semanal`,
          );
        }
      } catch (error) {
        console.error(`⚠️  [SCHEDULER] Resumen semanal falló para ${project.name}:`, error);
      }
    }
  }
}
