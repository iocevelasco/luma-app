import { useMemo } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { Activity, ActivityStatus } from '@luma/shared';
import { fromDayKey } from '@/lib/day-key';
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardBody,
  RowCardDate,
  RowCardEnd,
  RowCardList,
  type RowCardLeadTone,
} from '@/components/common/row-card-list';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/use-date-locale';
import { isActivityOverdue } from '@/lib/week';

/**
 * Qué grupo va primero: lo que pide una decisión (en revisión) y lo que está
 * en marcha, antes que lo que espera y que lo que ya cerró.
 */
const GROUP_ORDER: ActivityStatus[] = ['en_revision', 'en_curso', 'pendiente', 'completada', 'cancelada'];

const DATE_TONE: Partial<Record<ActivityStatus, RowCardLeadTone>> = {
  completada: 'success',
};

interface ActivityListProps {
  activities: Activity[];
  /** Actividades con materiales que no llegaron: se avisa en la fila. */
  missingMaterialIds: ReadonlySet<string>;
  onSelectActivity: (activityId: string) => void;
}

/**
 * La vista de lista de Actividades: lo mismo que el Cronograma y el Tablero,
 * leído de arriba abajo y sin ventana de tiempo — toda la obra, agrupada por
 * estado.
 *
 * Línea 1, qué es; línea 2, rubro · responsable · fechas. La fila **no repite
 * el estado**: ya lo dice el rótulo del grupo. Lo único que sí se marca en la
 * fila es lo que el grupo no dice: que está atrasada o que le faltan
 * materiales.
 */
export function ActivityList({ activities, missingMaterialIds, onSelectActivity }: ActivityListProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const groups = useMemo(() => {
    const byStatus = new Map<ActivityStatus, Activity[]>();
    for (const activity of activities) {
      byStatus.set(activity.status, [...(byStatus.get(activity.status) ?? []), activity]);
    }
    return GROUP_ORDER.flatMap((status) => {
      const items = byStatus.get(status);
      if (!items) return [];
      // Las atrasadas arriba, y después las que vencen antes.
      const sorted = [...items].sort((a, b) => {
        const lateA = isActivityOverdue(a.endDate, a.status);
        const lateB = isActivityOverdue(b.endDate, b.status);
        if (lateA !== lateB) return lateA ? -1 : 1;
        return a.endDate.localeCompare(b.endDate);
      });
      return [{ status, items: sorted }];
    });
  }, [activities]);

  const day = (key: string) => format(fromDayKey(key), 'd MMM', { locale: dateLocale });

  return (
    <ListSections>
      {groups.map(({ status, items }) => (
        <ListSection key={status} label={t(`activity.status.${status}`)} meta={items.length}>
          <RowCardList>
            {items.map((activity) => {
              const overdue = isActivityOverdue(activity.endDate, activity.status);
              const missing = missingMaterialIds.has(activity.id);
              const dates =
                activity.startDate === activity.endDate
                  ? day(activity.startDate)
                  : `${day(activity.startDate)} – ${day(activity.endDate)}`;

              return (
                <RowCard key={activity.id}>
                  <RowCardDate
                    date={fromDayKey(activity.endDate)}
                    locale={dateLocale}
                    tone={overdue ? 'danger' : (DATE_TONE[activity.status] ?? 'neutral')}
                    label={t('activity.list.endsOn', { date: day(activity.endDate) })}
                  />
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
                      activity.specialty ? t(`provider.specialty.${activity.specialty}`) : null,
                      activity.responsible.name,
                      dates,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                  {(overdue || missing) && (
                    <RowCardEnd>
                      {overdue && <Badge variant="danger">{t('activity.list.overdue')}</Badge>}
                      {missing && <Badge variant="warning">{t('activity.list.missingMaterials')}</Badge>}
                    </RowCardEnd>
                  )}
                </RowCard>
              );
            })}
          </RowCardList>
        </ListSection>
      ))}
    </ListSections>
  );
}

export default ActivityList;
