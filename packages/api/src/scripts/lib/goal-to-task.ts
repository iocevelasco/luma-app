import type { ActivityStatus, ProviderSpecialty } from '@luma/shared';

/**
 * Cómo una meta semanal se convierte en tarea. Lógica pura y aparte del
 * script para poder probarla sin base: es lo único de la migración que puede
 * equivocarse en silencio.
 */

/** Los estados de meta de las dos épocas (castellano y después inglés), en estado de tarea. */
const STATUS_BY_GOAL_STATUS: Readonly<Record<string, ActivityStatus>> = {
  pendiente: 'pendiente',
  pending: 'pendiente',
  in_progress: 'en_curso',
  cumplida: 'completada',
  done: 'completada',
  no_cumplida: 'cancelada',
  discarded: 'cancelada',
};

/** El domingo de la semana que arranca en `weekStart` (lunes, `YYYY-MM-DD`). */
export function weekEndOf(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day + 6));
  return sunday.toISOString().slice(0, 10);
}

export interface LegacyGoal {
  project: unknown;
  description: string;
  weekStart: string;
  status: string;
  completedAt?: Date | null;
  updatedAt: Date;
  createdBy: unknown;
}

export interface GoalOwner {
  name: string;
  specialty?: ProviderSpecialty;
}

export interface LinkedActivity {
  name: string;
  specialty?: ProviderSpecialty;
}

/**
 * Los campos de la tarea que reemplaza a una meta.
 *
 * - Dura la semana de la meta: lunes a domingo.
 * - El responsable es quien tenía la meta; la cuadrilla la arma el script.
 * - La especialidad sale de la actividad a la que apuntaba, si apuntaba a
 *   una; si no, de la persona; si no, "otra" — la tarea la exige.
 * - Una meta cumplida es una tarea cerrada: se le arma la revisión aprobada
 *   por quien la creó, con la fecha en que se cerró, para que no aparezca
 *   como cerrada sin que nadie la haya aprobado.
 */
export function goalToTask(
  goal: LegacyGoal,
  owner: GoalOwner | null,
  linkedActivity: LinkedActivity | null,
) {
  const status = STATUS_BY_GOAL_STATUS[goal.status] ?? 'pendiente';
  const closedAt = goal.completedAt ?? goal.updatedAt;

  return {
    project: goal.project,
    name: goal.description.slice(0, 120),
    startDate: goal.weekStart,
    endDate: weekEndOf(goal.weekStart),
    responsible: { name: owner?.name ?? 'Sin responsable' },
    status,
    specialty: linkedActivity?.specialty ?? owner?.specialty ?? 'otra',
    notes: linkedActivity ? `Parte de «${linkedActivity.name}».` : undefined,
    review:
      status === 'completada'
        ? {
            reportedBy: goal.createdBy,
            reportedAt: closedAt,
            approvedBy: goal.createdBy,
            approvedAt: closedAt,
          }
        : null,
    evidence: [],
    createdBy: goal.createdBy,
  };
}
