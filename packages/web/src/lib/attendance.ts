import type { Activity, ActivityAttendance } from '@luma/shared';

/**
 * El resumen de asistencia de un día de obra: cuántos se esperaban, cuántos
 * vinieron y cuántos faltan.
 *
 * Vive acá y no en cada pantalla porque lo muestran dos: la Jornada y la card
 * de metas del detalle. Antes la card contaba por su lado, contra el
 * `expectedCount` viejo de `LaborRecord` que la cuadrilla asignada reemplazó,
 * y por eso marcaba `0 / 0` aunque hubiera gente asignada.
 */

/** Las actividades que caen ese día. Comparación de strings `YYYY-MM-DD`, válida por el formato fijo. */
export function activitiesOnDay(activities: Activity[], date: string): Activity[] {
  return activities.filter((activity) => activity.startDate <= date && date <= activity.endDate);
}

export interface DayAttendanceSummary {
  present: number;
  expected: number;
  missing: number;
}

/**
 * Totales de la obra para un día.
 *
 * Los partes viejos no tienen gente del roster: su presente sale de los
 * nombres tipeados y su esperado del número que se cargaba a mano — si no,
 * esos días aparecerían en cero.
 */
export function summarizeDayAttendance(
  activitiesToday: Activity[],
  attendance: ActivityAttendance[],
): DayAttendanceSummary {
  const byActivity = new Map(attendance.map((item) => [item.activityId, item]));

  let present = 0;
  let expected = 0;
  for (const activity of activitiesToday) {
    const item = byActivity.get(activity.id);
    if (!item) continue;
    const fromRoster = item.presentCrewMemberIds.length;
    present += fromRoster > 0 ? fromRoster : item.legacyPresentNames.length;
    expected += item.expected.length > 0 ? item.expected.length : item.legacyExpectedCount;
  }

  return { present, expected, missing: Math.max(expected - present, 0) };
}
