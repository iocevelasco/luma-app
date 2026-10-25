import { differenceInCalendarDays, formatDistanceStrict, startOfDay, type Locale } from 'date-fns';
import { fromDayKey, toDayKey } from '@/lib/day-key';

/** Dónde está una obra en el tiempo, según sus fechas estimadas. No se guarda: se calcula. */
export type ProjectPhase = 'upcoming' | 'active' | 'done';

/** Qué dice el pie de la tarjeta. `endsToday` es el último día y no lleva distancia. */
export type ProjectCaptionKey = 'startsIn' | 'endsToday' | 'endsIn' | 'endedAgo';

export interface ProjectCaption {
  phase: ProjectPhase;
  key: ProjectCaptionKey;
  /** "en 3 días", "hace 2 meses". Ausente en `endsToday`. */
  distance?: string;
}

/** Desde acá la distancia se dice en meses; antes, en días. */
const DAYS_BEFORE_MONTHS = 30;

/**
 * El pie de la tarjeta de una obra: cuánto falta para que empiece, para que
 * termine, o cuánto hace que terminó.
 *
 * Se compara por **días de calendario**, no por instantes. `estimatedEndDate`
 * es un día (`YYYY-MM-DD`) y `fromDayKey` lo vuelve la medianoche local de ese
 * día: medido contra "ahora", el último día de la obra ya quedó 14 horas atrás
 * y la tarjeta decía "Termina hace 14 horas" sobre una obra vigente. Acá "hoy"
 * es el día entero: el último día dice "Termina hoy" y una obra en curso nunca
 * habla en horas.
 */
export function projectCaption(
  { estimatedStartDate, estimatedEndDate }: { estimatedStartDate: string; estimatedEndDate: string },
  now: Date,
  locale: Locale,
): ProjectCaption {
  const today = toDayKey(now);
  // Medianoche contra medianoche: la distancia sale exacta en días, sin la fracción de hora.
  const midnight = startOfDay(now);
  const distance = (day: string) => {
    const days = differenceInCalendarDays(fromDayKey(day), now);
    return formatDistanceStrict(fromDayKey(day), midnight, {
      addSuffix: true,
      locale,
      // Un cambio de hora hace que un día dure 23 h y la unidad automática lo
      // diga en horas: se fija en días mientras no llegue a meses.
      unit: Math.abs(days) < DAYS_BEFORE_MONTHS ? 'day' : undefined,
    });
  };

  if (today < estimatedStartDate) {
    return { phase: 'upcoming', key: 'startsIn', distance: distance(estimatedStartDate) };
  }
  if (today > estimatedEndDate) {
    return { phase: 'done', key: 'endedAgo', distance: distance(estimatedEndDate) };
  }
  if (today === estimatedEndDate) return { phase: 'active', key: 'endsToday' };
  return { phase: 'active', key: 'endsIn', distance: distance(estimatedEndDate) };
}
