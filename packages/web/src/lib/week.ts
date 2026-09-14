import { toDayKey } from '@/components/common/date-range-filter';

/**
 * Semana ISO (arranca lunes) para la vista de planificación (RF-01). No hay
 * entidad `Week` en el backend: todo el cálculo vive acá, en el cliente.
 *
 * Parsing manual de `YYYY-MM-DD` en vez de `new Date('YYYY-MM-DD')` a propósito
 * — ver CLAUDE.md sobre Safari y fechas.
 */
export interface WeekRange {
  from: string;
  to: string;
}

function parseDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Lunes de la semana que contiene `date` (día 0 = domingo en JS). */
export function mondayOf(date: Date): Date {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
  return monday;
}

export function weekRangeOf(date: Date): WeekRange {
  const monday = mondayOf(date);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: toDayKey(monday), to: toDayKey(sunday) };
}

export function currentWeekRange(): WeekRange {
  return weekRangeOf(new Date());
}

export function shiftWeek(range: WeekRange, deltaWeeks: number): WeekRange {
  const monday = parseDayKey(range.from);
  const shifted = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + deltaWeeks * 7);
  return weekRangeOf(shifted);
}

export function isSameWeek(a: WeekRange, b: WeekRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/**
 * "Atrasada" es derivado, nunca persistido: vencida (comparación lexicográfica
 * de strings `YYYY-MM-DD`, válida porque el formato es fijo) y sin cerrar.
 */
export function isActivityOverdue(
  endDate: string,
  status: 'pendiente' | 'en_curso' | 'completada' | 'cancelada',
  today = toDayKey(new Date()),
): boolean {
  return endDate < today && status !== 'completada' && status !== 'cancelada';
}

/** `endDate` dentro de los próximos `days` días (inclusive), desde hoy. */
export function isWithinNextDays(endOrStartDate: string, days: number, today = new Date()): boolean {
  const target = parseDayKey(endOrStartDate);
  const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target >= todayStart && target <= limit;
}
