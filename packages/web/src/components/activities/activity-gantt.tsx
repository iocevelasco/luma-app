import { useCallback, useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Gantt, WillowDark, type IApi, type IColumnConfig } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/style.css';
import type { Activity, ActivityStatus } from '@luma/shared';
import { fromDayKey } from '@/components/common/date-range-filter';
import { TruncatedText } from '@/components/common/truncated-text';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/use-date-locale';
import { isActivityOverdue } from '@/lib/week';

/**
 * Progreso mostrado en la barra del Gantt (relleno de la librería) — no hay
 * subtareas ni % parcial en el modelo de Activity, así que es un mapeo fijo
 * por estado, no un cálculo.
 */
const STATUS_PROGRESS: Record<ActivityStatus, number> = {
  pendiente: 0,
  en_curso: 50,
  completada: 100,
  cancelada: 0,
};

interface GanttTaskRow {
  activity: Activity;
  missingMaterials: boolean;
}

function TextCell({ row }: { row: unknown }) {
  return <TruncatedText text={(row as GanttTaskRow).activity.name} />;
}

function AreaCell({ row }: { row: unknown }) {
  return <TruncatedText text={(row as GanttTaskRow).activity.area} />;
}

function ResponsibleCell({ row }: { row: unknown }) {
  return <TruncatedText text={(row as GanttTaskRow).activity.responsible.name} />;
}

function StatusCell({ row }: { row: unknown }) {
  const { t } = useTranslation();
  const { activity } = row as GanttTaskRow;
  const overdue = isActivityOverdue(activity.endDate, activity.status);

  return (
    <div className="flex items-center gap-1">
      <Badge variant={overdue ? 'destructive' : 'secondary'}>
        {t(`activity.status.${activity.status}`)}
      </Badge>
    </div>
  );
}

interface ActivityGanttProps {
  activities: Activity[];
  range: { from: string; to: string };
  onSelectActivity: (activityId: string) => void;
  missingMaterialActivityIds?: Set<string>;
}

/** Diagrama de Gantt de las actividades de una obra, acotado al rango elegido en `range`. */
export function ActivityGantt({
  activities,
  range,
  onSelectActivity,
  missingMaterialActivityIds,
}: ActivityGanttProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const tasks = useMemo(
    () =>
      activities.map((activity) => ({
        id: activity.id,
        text: activity.name,
        start: fromDayKey(activity.startDate),
        end: addDays(fromDayKey(activity.endDate), 1),
        progress: STATUS_PROGRESS[activity.status],
        type: 'task' as const,
        activity,
        missingMaterials: missingMaterialActivityIds?.has(activity.id) ?? false,
      })),
    [activities, missingMaterialActivityIds],
  );

  const columns: IColumnConfig[] = useMemo(
    () => [
      { id: 'text', header: t('activity.fields.name'), width: 180, flexgrow: 1, cell: TextCell },
      { id: 'area', header: t('activity.fields.area'), width: 120, cell: AreaCell },
      { id: 'responsible', header: t('activity.fields.responsible'), width: 140, cell: ResponsibleCell },
      { id: 'status', header: t('activity.fields.status'), width: 140, cell: StatusCell },
    ],
    [t],
  );

  const scales = useMemo(
    () => [
      { unit: 'month', step: 1, format: (date: Date) => format(date, 'MMMM yyyy', { locale: dateLocale }) },
      { unit: 'day', step: 1, format: (date: Date) => format(date, 'd', { locale: dateLocale }) },
    ],
    [dateLocale],
  );

  const handleInit = useCallback(
    (api: IApi) => {
      api.on('select-task', ({ id }: { id: string | number }) => onSelectActivity(String(id)));
    },
    [onSelectActivity],
  );

  return (
    <div className="min-h-0 min-w-0 flex-1 [&_.wx-theme]:h-full">
      <WillowDark fonts={false}>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          columns={columns}
          start={fromDayKey(range.from)}
          end={addDays(fromDayKey(range.to), 1)}
          cellWidth={32}
          cellHeight={40}
          gridWidth={580}
          readonly
          init={handleInit}
        />
      </WillowDark>
    </div>
  );
}

export default ActivityGantt;
