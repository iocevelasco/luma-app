import { useCallback, useEffect, useMemo, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Gantt, WillowDark, type IApi, type IColumnConfig } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/style.css';
import type { Activity, ActivityStatus } from '@luma/shared';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { TruncatedText } from '@/components/common/truncated-text';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/use-date-locale';
import { cn } from '@/lib/utils';
import { isActivityOverdue } from '@/lib/week';

/**
 * Progreso mostrado en la barra del Gantt (relleno de la librería) — no hay
 * subtareas ni % parcial en el modelo de Activity, así que es un mapeo fijo
 * por estado, no un cálculo.
 */
const STATUS_PROGRESS: Record<ActivityStatus, number> = {
  pendiente: 0,
  en_curso: 50,
  // Reportada como terminada pero sin validar: casi llena, no llena. La barra
  // no puede decir 100% de algo que el supervisor todavía no aprobó.
  en_revision: 90,
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

function SpecialtyCell({ row }: { row: unknown }) {
  const { t } = useTranslation();
  const { specialty } = (row as GanttTaskRow).activity;
  // TruncatedText recibe un string; no se puede pasar <SpecialtyLabel />.
  return (
    <TruncatedText
      text={specialty ? t(`provider.specialty.${specialty}`) : t('activity.detail.noSpecialty')}
    />
  );
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
  /**
   * Si `true`, al abrir (y cada vez que cambia `focusRequest`) el diagrama se
   * posiciona en la fecha de hoy y la columna de hoy queda teñida. Una obra se planifica a meses vista: sin
   * esto, abrir el Cronograma en la mitad de la obra muestra el principio, y
   * lo que se está haciendo ahora queda fuera de la pantalla.
   */
  focusOnToday?: boolean;
  focusRequest?: number;
}

/** Días de contexto que se dejan antes de hoy al posicionar el diagrama. */
const LEAD_DAYS = 3;

/** Diagrama de Gantt de las actividades de una obra, acotado al rango elegido en `range`. */
export function ActivityGantt({
  activities,
  range,
  onSelectActivity,
  missingMaterialActivityIds,
  focusOnToday = false,
  focusRequest = 0,
}: ActivityGanttProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const apiRef = useRef<IApi | null>(null);

  const todayKey = toDayKey(new Date());
  // Fuera del rango no hay columna marcada ni scroll: "hoy" no puede cambiar
  // el rango que se pidió.
  const todayInRange = todayKey >= range.from && todayKey <= range.to;

  // La edición libre de la librería no trae la línea vertical (`markers` es
  // PRO): se tiñe la columna del día, que dice lo mismo.
  const highlightToday = useCallback(
    (date: Date, unit: 'day' | 'hour') =>
      unit === 'day' && toDayKey(date) === todayKey ? 'luma-gantt-today' : '',
    [todayKey],
  );

  useEffect(() => {
    if (!focusOnToday || !todayInRange) return;
    // Un cuadro después: el diagrama mide su ancho recién al montarse.
    const frame = window.requestAnimationFrame(() => {
      apiRef.current?.exec('scroll-chart', { date: addDays(fromDayKey(todayKey), -LEAD_DAYS) });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusOnToday, todayInRange, todayKey, range.from, range.to, focusRequest]);

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
      { id: 'specialty', header: t('activity.fields.specialty'), width: 140, cell: SpecialtyCell },
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
      apiRef.current = api;
      api.on('select-task', ({ id }: { id: string | number }) => onSelectActivity(String(id)));
    },
    [onSelectActivity],
  );

  return (
    <div
      className={cn(
        'min-h-0 min-w-0 flex-1 [&_.wx-theme]:h-full',
        // La columna de hoy, en el verde de la marca y apenas teñida.
        '[&_.luma-gantt-today]:bg-primary/20',
      )}
    >
      <WillowDark fonts={false}>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          highlightTime={highlightToday}
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
