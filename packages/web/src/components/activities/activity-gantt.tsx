import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Activity, ActivityStatus } from '@luma/shared';
import { fromDayKey } from '@/components/common/date-range-filter';
import { useDateLocale } from '@/hooks/use-date-locale';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_COLUMN_PX = 32;

const STATUS_BAR_CLASS: Record<ActivityStatus, string> = {
  pendiente: 'bg-muted-foreground/40',
  en_curso: 'bg-primary',
  completada: 'bg-secondary-foreground/60',
  cancelada: 'bg-destructive/60',
};

function dayIndex(day: string, rangeStart: Date): number {
  const date = fromDayKey(day);
  return Math.round((date.getTime() - rangeStart.getTime()) / DAY_MS);
}

interface ActivityGanttProps {
  activities: Activity[];
  range: { from: string; to: string };
  onSelectActivity: (activityId: string) => void;
}

/** Diagrama de Gantt de las actividades de una obra, acotado al rango elegido en `range`. */
export function ActivityGantt({ activities, range, onSelectActivity }: ActivityGanttProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const rangeStart = fromDayKey(range.from);
  const rangeEnd = fromDayKey(range.to);
  const dayCount = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1);

  const days = useMemo(
    () =>
      Array.from(
        { length: dayCount },
        (_, i) => new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i),
      ),
    [range.from, range.to, dayCount, rangeStart],
  );

  const dayFmt = new Intl.DateTimeFormat(dateLocale?.code ?? undefined, { day: '2-digit' });
  const monthFmt = new Intl.DateTimeFormat(dateLocale?.code ?? undefined, { month: 'short' });

  if (activities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t('activity.gantt.emptyState')}</p>
    );
  }

  const gridTemplateColumns = `repeat(${dayCount}, minmax(${DAY_COLUMN_PX}px, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: dayCount * DAY_COLUMN_PX }}>
        <div className="grid border-b border-border" style={{ gridTemplateColumns }}>
          {days.map((day, i) => (
            <div
              key={i}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 text-2xs text-muted-foreground',
                (day.getDay() === 0 || day.getDay() === 6) && 'bg-muted/40',
              )}
            >
              <span>{monthFmt.format(day)}</span>
              <span className="font-medium text-foreground">{dayFmt.format(day)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col divide-y divide-border">
          {activities.map((activity) => {
            const startIdx = Math.max(0, dayIndex(activity.startDate, rangeStart));
            const endIdx = Math.min(dayCount - 1, dayIndex(activity.endDate, rangeStart));
            const span = Math.max(1, endIdx - startIdx + 1);

            return (
              <button
                key={activity.id}
                type="button"
                onClick={() => onSelectActivity(activity.id)}
                className="grid items-center py-2 text-left hover:bg-accent/50"
                style={{ gridTemplateColumns }}
              >
                {endIdx >= 0 && startIdx < dayCount && (
                  <div
                    className={cn('h-6 rounded-md', STATUS_BAR_CLASS[activity.status])}
                    style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
                    title={activity.name}
                  >
                    <span className="sr-only">{activity.name}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ActivityGantt;
