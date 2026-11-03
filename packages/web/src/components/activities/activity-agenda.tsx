import { useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Activity } from '@luma/shared';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardBody,
  RowCardEnd,
  RowCardList,
} from '@/components/common/row-card-list';
import { Button } from '@/components/ui/button';
import { useSpecialtyLabel } from '@/hooks/activities/use-specialty-label';
import { useDateLocale } from '@/hooks/use-date-locale';
import { activitiesOfDay } from '@/lib/activities-day';
import { toDayKey } from '@/lib/day-key';
import {
  MOBILE_ROW,
  MOBILE_ROW_LIST,
  MOBILE_SECTION,
  MOBILE_SECTIONS,
} from '@/lib/mobile-list-density';

/** La semana empieza el lunes, como en la planificación semanal. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

interface ActivityAgendaProps {
  activities: Activity[];
  onSelectActivity: (activityId: string) => void;
}

/**
 * El Cronograma en un teléfono: el diagrama de Gantt no entra en 375 px, así que
 * se lee como una agenda — una semana, día por día, con lo que se trabaja cada
 * día. Son las mismas actividades que el diagrama (`activitiesOfDay`), sin
 * entidad nueva. Una actividad de varios días aparece en cada uno de ellos.
 *
 * Los controles son sólo íconos: semana anterior, siguiente y volver a hoy.
 */
export function ActivityAgenda({ activities, onSelectActivity }: ActivityAgendaProps) {
  const { t } = useTranslation();
  const specialtyLabel = useSpecialtyLabel();
  const dateLocale = useDateLocale();

  const todayKey = toDayKey(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), WEEK_OPTIONS));

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const key = toDayKey(date);
        return { date, key, items: activitiesOfDay(activities, key) };
      }),
    [activities, weekStart],
  );
  const withActivities = days.filter((day) => day.items.length > 0);

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${format(weekStart, 'd MMM', { locale: dateLocale })} – ${format(weekEnd, 'd MMM', {
    locale: dateLocale,
  })}`;
  const isCurrentWeek = days.some((day) => day.key === todayKey);

  return (
    <div className="flex flex-col gap-3" data-testid="activity-agenda">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-11"
          aria-label={t('activity.agenda.previousWeek')}
          onClick={() => setWeekStart((current) => addDays(current, -7))}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium" aria-live="polite">
          {rangeLabel}
        </p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-11"
          aria-label={t('activity.agenda.nextWeek')}
          onClick={() => setWeekStart((current) => addDays(current, 7))}
        >
          <ChevronRight className="size-5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-11"
          aria-label={t('activity.gantt.goToToday')}
          disabled={isCurrentWeek}
          onClick={() => setWeekStart(startOfWeek(new Date(), WEEK_OPTIONS))}
        >
          <CalendarCheck className="size-4" />
        </Button>
      </div>

      {withActivities.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t('activity.agenda.empty')}</p>
      ) : (
        <ListSections className={MOBILE_SECTIONS}>
          {withActivities.map(({ date, key, items }) => (
            <ListSection
              key={key}
              label={
                key === todayKey
                  ? `${t('activity.agenda.today')} · ${format(date, 'EEE d MMM', { locale: dateLocale })}`
                  : format(date, 'EEE d MMM', { locale: dateLocale })
              }
              meta={items.length}
              className={MOBILE_SECTION}
            >
              <RowCardList className={MOBILE_ROW_LIST}>
                {items.map((activity) => (
                  <RowCard key={activity.id} className={MOBILE_ROW}>
                    <RowCardBody
                      title={
                        <button
                          type="button"
                          onClick={() => onSelectActivity(activity.id)}
                          className="text-left hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {activity.name}
                        </button>
                      }
                      meta={[
                        activity.specialty ? specialtyLabel(activity.specialty) : null,
                        activity.responsible.name,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                    <RowCardEnd>
                      <ActivityStatusBadge status={activity.status} endDate={activity.endDate} />
                    </RowCardEnd>
                  </RowCard>
                ))}
              </RowCardList>
            </ListSection>
          ))}
        </ListSections>
      )}
    </div>
  );
}

export default ActivityAgenda;
