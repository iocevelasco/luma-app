import type { Activity, ActivityStatus } from '@luma/shared';
import { isActivityOverdue } from './week';

/**
 * Las actividades de un día. Aparte de `activities-day-pdf.ts` a propósito: la
 * pantalla de Actividades las necesita para contar y filtrar apenas se abre, y
 * el módulo del PDF es el que se baja recién cuando hace falta (con `jspdf`).
 */

/** Primero lo que pide una decisión y lo que está en marcha; lo ya cerrado, al final. */
const STATUS_ORDER: ActivityStatus[] = ['en_revision', 'en_curso', 'pendiente', 'completada'];

/**
 * Las actividades de un día: las que tienen ese día dentro de sus fechas, sin
 * las canceladas (no se hacen). Comparación de strings `YYYY-MM-DD`, válida por
 * el formato fijo. En el orden en que se leen en la hoja: por estado, las
 * atrasadas primero y después por fecha de fin.
 */
export function activitiesOfDay(activities: Activity[], day: string): Activity[] {
  return activities
    .filter(
      (activity) =>
        activity.status !== 'cancelada' && activity.startDate <= day && activity.endDate >= day,
    )
    .sort((a, b) => {
      const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (byStatus !== 0) return byStatus;
      const lateA = isActivityOverdue(a.endDate, a.status, day);
      const lateB = isActivityOverdue(b.endDate, b.status, day);
      if (lateA !== lateB) return lateA ? -1 : 1;
      return a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name);
    });
}
