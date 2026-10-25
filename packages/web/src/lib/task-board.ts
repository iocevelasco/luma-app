import { normalizePersonName, type Activity, type ActivityStatus, type Capability } from '@luma/shared';
import { toDayKey } from '@/components/common/date-range-filter';
import type { WeekRange } from '@/lib/week';

/**
 * El Tablero de tareas. Una tarea ES una actividad: lo que se carga acá
 * aparece en el Cronograma, y al revés. Este archivo decide qué tareas ve el
 * Tablero en una semana, en qué columna va cada una y qué movimientos puede
 * hacer cada rol.
 *
 * Lógica pura y aparte del componente para probarla sin montar React: las
 * reglas de quién mueve qué son las que más fácil se rompen en silencio.
 */

/** Las columnas, en el orden en que se leen. `cancelada` no es columna: se ve aparte. */
export const TASK_COLUMNS = ['pendiente', 'en_curso', 'en_revision', 'completada'] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

export function isTaskColumn(status: ActivityStatus): status is TaskColumn {
  return (TASK_COLUMNS as readonly ActivityStatus[]).includes(status);
}

/** Abierta = hay que terminarla. */
export function isOpenTask(status: ActivityStatus): boolean {
  return status !== 'completada' && status !== 'cancelada';
}

/**
 * Las tareas de una semana: las que caen en ella (aunque empiecen antes o
 * terminen después). En la semana en curso entran además las atrasadas —
 * vencidas antes y todavía abiertas—: son lo primero que hay que resolver, y
 * si no aparecieran acá no aparecerían en ningún tablero.
 *
 * Y las que se **cerraron o cancelaron en esa semana**, por más viejas que sean
 * sus fechas. Sin esto, pasar una atrasada a Completada la sacaba del tablero en
 * el mismo instante: ya no cae en la semana ni está abierta, así que la tarjeta
 * se esfumaba al soltarla. Es por la fecha de modificación (`updatedAt`): cerrar
 * es tocarla. Una tarea cerrada hace meses y editada hoy también vuelve a verse
 * esta semana; es el precio de no guardar una fecha de cierre aparte.
 *
 * Comparación de strings `YYYY-MM-DD`, válida por el formato fijo.
 */
export function tasksForWeek(
  activities: Activity[],
  week: WeekRange,
  { includeOverdue }: { includeOverdue: boolean },
): Activity[] {
  return activities.filter((activity) => {
    const overlaps = activity.startDate <= week.to && activity.endDate >= week.from;
    const overdue =
      includeOverdue && activity.endDate < week.from && isOpenTask(activity.status);
    const touched = toDayKey(new Date(activity.updatedAt));
    const closedInWeek = !isOpenTask(activity.status) && touched >= week.from && touched <= week.to;
    return overlaps || overdue || closedInWeek;
  });
}

/**
 * Quién es el responsable, como clave para el filtro. El usuario si es alguien
 * con cuenta; si no, el nombre normalizado — "Juan Pérez" y "juan perez" son
 * la misma persona en el filtro.
 */
export function responsibleKey(activity: Activity): string {
  return activity.responsible.user
    ? `user:${activity.responsible.user}`
    : `name:${normalizePersonName(activity.responsible.name)}`;
}

export interface TaskLayout {
  columns: Record<TaskColumn, Activity[]>;
  cancelled: Activity[];
}

/**
 * Reparte por estado. Con `responsible`, sólo las de esa persona: "¿qué
 * tiene fulano?". Dentro de cada columna, las atrasadas primero y después
 * por fecha de fin: lo más urgente arriba.
 */
export function layoutTasks(
  tasks: Activity[],
  responsible: string | null,
  today: string,
): TaskLayout {
  const layout: TaskLayout = {
    columns: { pendiente: [], en_curso: [], en_revision: [], completada: [] },
    cancelled: [],
  };

  const isLate = (task: Activity) => task.endDate < today && isOpenTask(task.status);
  const sorted = [...tasks].sort((a, b) => {
    if (isLate(a) !== isLate(b)) return isLate(a) ? -1 : 1;
    return a.endDate.localeCompare(b.endDate);
  });

  for (const task of sorted) {
    if (responsible && responsibleKey(task) !== responsible) continue;
    if (isTaskColumn(task.status)) layout.columns[task.status].push(task);
    else layout.cancelled.push(task);
  }

  return layout;
}

/** Las personas responsables de alguna tarea del tablero, para el filtro. */
export function taskPeople(tasks: Activity[]): { key: string; name: string }[] {
  const byKey = new Map<string, string>();
  for (const task of tasks) byKey.set(responsibleKey(task), task.responsible.name);
  return [...byKey.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A qué estados puede mover una tarea quien tiene estas capacidades. Es la
 * misma regla que aplica la API (`updateActivity`); acá sirve para no
 * ofrecer un movimiento que termina en 403.
 *
 * - Mover por el flujo (pendiente, en curso, en revisión) es `activity.report`.
 * - Cerrar (completada) y reabrir una completada es `activity.review`.
 * - Cancelar y restaurar una cancelada es `activity.plan`: es modificar.
 *
 * "Devolver" (en revisión → en curso con motivo) no está acá: pide un motivo
 * y va por su propio camino.
 */
export function allowedMoves(
  status: ActivityStatus,
  can: (capability: Capability) => boolean,
): ActivityStatus[] {
  if (status === 'cancelada') return can('activity.plan') ? ['pendiente'] : [];
  if (status === 'completada' && !can('activity.review')) return [];

  const moves: ActivityStatus[] = TASK_COLUMNS.filter((column) => {
    if (column === status) return false;
    if (column === 'completada') return can('activity.review');
    return can('activity.report');
  });
  if (can('activity.plan')) moves.push('cancelada');
  return moves;
}

/** Días que dura una tarea, contando el primero y el último. Una de un día dura 1. */
export function durationDays(task: Pick<Activity, 'startDate' | 'endDate'>): number {
  const day = (key: string) => {
    const [year, month, date] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.max(Math.round((day(task.endDate) - day(task.startDate)) / 86_400_000) + 1, 1);
}

/**
 * Avance de la obra: días de tareas completadas sobre días de tareas no
 * canceladas. Ponderado por duración para que veinte tareas de un día no
 * pesen lo mismo que una de dos meses.
 */
export function weightedProgress(tasks: Activity[]): {
  percent: number;
  completed: number;
  total: number;
} {
  const relevant = tasks.filter((task) => task.status !== 'cancelada');
  const done = relevant.filter((task) => task.status === 'completada');
  const totalDays = relevant.reduce((sum, task) => sum + durationDays(task), 0);
  const doneDays = done.reduce((sum, task) => sum + durationDays(task), 0);
  return {
    percent: totalDays === 0 ? 0 : Math.round((doneDays / totalDays) * 100),
    completed: done.length,
    total: relevant.length,
  };
}
