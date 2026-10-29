import { useCallback, useEffect, useMemo, useRef } from 'react';
import { addDays, addMonths, addQuarters, format, startOfMonth, startOfQuarter } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Gantt, Willow, type IApi, type IColumnConfig } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/style.css';
import type { Activity, ActivityStatus } from '@luma/shared';
import { fromDayKey, toDayKey } from '@/lib/day-key';
import { TruncatedText } from '@/components/common/truncated-text';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { useDateLocale } from '@/hooks/use-date-locale';
import type { GanttZoom } from '@/lib/gantt-zoom';
import { cn } from '@/lib/utils';

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

interface ActivityGanttProps {
  activities: Activity[];
  range: { from: string; to: string };
  zoom: GanttZoom;
  onSelectActivity: (activityId: string) => void;
  /**
   * Si viene, las barras se arrastran y se estiran: es mover las fechas de la
   * actividad (`activity.plan`). Sin ella el diagrama es de sólo lectura.
   * `endDate` es el último día de trabajo, inclusive.
   */
  onReschedule?: (activityId: string, startDate: string, endDate: string) => void;
  /**
   * Si `true`, al abrir (y cada vez que cambia `focusRequest`) el diagrama se
   * posiciona en la fecha de hoy y la columna de hoy queda teñida. Una obra se planifica a meses vista: sin
   * esto, abrir el Cronograma en la mitad de la obra muestra el principio, y
   * lo que se está haciendo ahora queda fuera de la pantalla.
   */
  focusOnToday?: boolean;
  focusRequest?: number;
  /**
   * Filas vacías al final del diagrama: aire para scrollear la última tarea por
   * encima del botón flotante «Nueva tarea». Van dentro del scroll y no como
   * relleno de la pantalla, así el diagrama llega hasta el borde de la ventana y
   * el botón sólo tapa espacio vacío. Cero si no hay botón.
   */
  trailingRows?: number;
}

interface GanttTaskRow {
  /** Falta en las filas de aire del final (`SPACER_PREFIX`). */
  activity?: Activity;
}

/** Id de las filas de aire: no son actividades, y ni se ven ni se tocan. */
const SPACER_PREFIX = '__space';

function TextCell({ row }: { row: unknown }) {
  const { activity } = row as GanttTaskRow;
  return activity ? <TruncatedText text={activity.name} /> : null;
}

function SpecialtyCell({ row }: { row: unknown }) {
  const { t } = useTranslation();
  const { activity } = row as GanttTaskRow;
  if (!activity) return null;
  const { specialty } = activity;
  // TruncatedText recibe un string; no se puede pasar <SpecialtyLabel />.
  return (
    <TruncatedText
      text={specialty ? t(`provider.specialty.${specialty}`) : t('activity.detail.noSpecialty')}
    />
  );
}

function ResponsibleCell({ row }: { row: unknown }) {
  const { activity } = row as GanttTaskRow;
  return activity ? <TruncatedText text={activity.responsible.name} /> : null;
}

function StatusCell({ row }: { row: unknown }) {
  const { activity } = row as GanttTaskRow;
  if (!activity) return null;

  return (
    <div className="flex items-center gap-1">
      <ActivityStatusBadge status={activity.status} endDate={activity.endDate} alignOverdue />
    </div>
  );
}

/** Días de contexto que se dejan antes de hoy al posicionar el diagrama. */
const LEAD_DAYS = 3;

/** Lo que tarda la librería en reacomodar la escala después de un cambio de zoom (medido: 250 ms alcanza en los cuatro). */
const ZOOM_SETTLE_MS = 250;

/**
 * Lo que la librería sabe hacer y Luma no: no hay jerarquía, no hay
 * dependencias y las filas no se crean ni se borran desde acá. Se cortan en el
 * origen —antes de que la librería cambie su estado— y no ocultando botones,
 * porque también se disparan con el teclado (Supr, arrastrar una fila).
 */
const BLOCKED_ACTIONS = ['add-task', 'delete-task', 'move-task', 'indent-task', 'add-link', 'update-link'];

/** Diagrama de Gantt de las actividades de una obra, acotado al rango elegido en `range`. */
export function ActivityGantt({
  activities,
  range,
  zoom,
  onSelectActivity,
  onReschedule,
  focusOnToday = false,
  focusRequest = 0,
  trailingRows = 0,
}: ActivityGanttProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const apiRef = useRef<IApi | null>(null);

  // Los manejadores se enganchan una sola vez, al iniciar la librería: leen lo
  // último por ref para no quedar con la lista de actividades de ese momento.
  const activitiesRef = useRef(activities);
  const selectRef = useRef(onSelectActivity);
  const rescheduleRef = useRef(onReschedule);
  useEffect(() => {
    activitiesRef.current = activities;
    selectRef.current = onSelectActivity;
    rescheduleRef.current = onReschedule;
  });

  const todayKey = toDayKey(new Date());
  // Fuera del rango no hay columna marcada ni scroll: "hoy" no puede cambiar
  // el rango que se pidió.
  const todayInRange = todayKey >= range.from && todayKey <= range.to;

  // La edición libre de la librería no trae la línea vertical (`markers` es
  // PRO): se tiñe la columna del día, que dice lo mismo. Sólo se dibuja en la
  // escala de días; en semanas, meses y trimestres la celda es más ancha que
  // un día y la librería no avisa de la fecha.
  const highlightToday = useCallback(
    (date: Date, unit: 'day' | 'hour') =>
      unit === 'day' && toDayKey(date) === todayKey ? 'luma-gantt-today' : '',
    [todayKey],
  );

  // El salto a hoy es una orden, no un efecto de lo que cambie alrededor. Lo
  // dispara el montaje, "Ir a hoy" (`focusRequest`) y un cambio de zoom, y nada
  // más: que crezca el rango (una tarea arrastrada o creada fuera de las fechas
  // de la obra) o que pase la medianoche no puede devolver el diagrama a hoy
  // mientras la persona está mirando otra parte. Lo demás se lee por ref: si
  // fuera dependencia del efecto, cambiarlo lo volvería a disparar.
  const focusStateRef = useRef({ focusOnToday, todayInRange, todayKey });
  useEffect(() => {
    focusStateRef.current = { focusOnToday, todayInRange, todayKey };
  });

  /**
   * Posiciona el diagrama en hoy, tras esperar `delayMs`. Devuelve cómo cancelar
   * lo que quede pendiente.
   */
  const scrollToToday = useCallback((delayMs = 0) => {
    const { focusOnToday: enabled, todayInRange: inRange, todayKey: today } = focusStateRef.current;
    if (!enabled || !inRange) return undefined;
    const date = addDays(fromDayKey(today), -LEAD_DAYS);
    let first = 0;
    let second = 0;
    const timer = window.setTimeout(() => {
      // Un cuadro después: el diagrama mide su ancho recién al montarse.
      first = window.requestAnimationFrame(() => {
        // La librería no se entera de lo que la persona desplazó con el scroll: si
        // ya cree estar en esa fecha, "ir a hoy" no hace nada. Se la lleva primero
        // al origen y, un cuadro después, a hoy: así el cambio es siempre real.
        apiRef.current?.exec('scroll-chart', { left: 0 });
        second = window.requestAnimationFrame(() => {
          apiRef.current?.exec('scroll-chart', { date });
        });
      });
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, []);

  // Al montar y con cada "Ir a hoy".
  useEffect(() => scrollToToday(), [focusRequest, scrollToToday]);

  // Al cambiar el zoom, a hoy **a propósito**: el scroll se guarda en píxeles y
  // un píxel es otra fecha en cada escala. Sin recentrar, el diagrama quedaba
  // mirando una fecha cualquiera. No corre en el primer render: de eso se ocupa
  // el montaje. Con espera: pidiéndole la fecha antes de que la librería termine
  // de acomodar la escala nueva, en Meses y Trimestres el scroll terminaba al
  // final del diagrama (medido en Chromium; con ZOOM_SETTLE_MS cae en hoy).
  const previousZoomRef = useRef(zoom);
  useEffect(() => {
    if (previousZoomRef.current === zoom) return undefined;
    previousZoomRef.current = zoom;
    return scrollToToday(ZOOM_SETTLE_MS);
  }, [zoom, scrollToToday]);

  // La etiqueta del mes de la escala es un `span` pegajoso que se queda a la
  // izquierda mientras ese mes está a la vista, pero acotado a lo que queda
  // visible de su celda. Con un solo día de un mes a la vista no entra y se veía
  // cortada ("ulio 2026"): se esconde mientras no entre, y vuelve al desplazar.
  //
  // No se resuelve con CSS: "cuánto de esta celda quedó dentro del área que
  // desplaza" depende del scroll, y una hoja de estilos no lo puede preguntar
  // (sólo las animaciones atadas al scroll, que Safari estable no tiene).
  //
  // Depende de cómo arma el DOM `@svar-ui/react-gantt` 2.8.1, y por eso la versión
  // está fija en `package.json`:
  //  - `.wx-chart`: el área que desplaza el diagrama.
  //  - `.wx-scale .wx-row:first-child .wx-cell`: las celdas de la fila de arriba de
  //    la escala (los meses). La librería sólo dibuja las que están a la vista.
  //  - `.wx-cell-value`: la etiqueta pegajosa; la librería se la pone a la celda sólo
  //    si mide más de 100 px, y es `position: sticky; left: 0`.
  // Si una actualización renombra alguna, el selector no encuentra nada y la etiqueta
  // vuelve a verse cortada: hay un E2E que lo avisa ("la etiqueta del mes se esconde").
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const chart = root.querySelector<HTMLElement>('.wx-chart');
      if (!chart) return;
      const area = chart.getBoundingClientRect();
      root.querySelectorAll<HTMLElement>('.wx-scale .wx-row:first-child .wx-cell').forEach((cell) => {
        const label = cell.querySelector<HTMLElement>('.wx-cell-value');
        if (!label) return;
        const box = cell.getBoundingClientRect();
        const visible = Math.min(box.right, area.right) - Math.max(box.left, area.left);
        label.style.visibility = visible < label.scrollWidth + 8 ? 'hidden' : '';
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    // `scroll` no burbuja: se escucha en captura para enterarse del scroll del diagrama.
    root.addEventListener('scroll', schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    schedule();
    return () => {
      root.removeEventListener('scroll', schedule, true);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [zoom]);

  const tasks = useMemo(() => {
    const rows = activities.map((activity) => ({
        id: activity.id,
        text: activity.name,
        start: fromDayKey(activity.startDate),
        // La librería toma `end` como exclusivo: el último día de trabajo termina a fin de día.
        end: addDays(fromDayKey(activity.endDate), 1),
        progress: STATUS_PROGRESS[activity.status],
        type: 'task' as const,
        activity,
      }));
    // Filas de aire: sin `activity`, así que sin texto; el CSS les saca la barra.
    const day = fromDayKey(range.from);
    const spacers = Array.from({ length: trailingRows }, (_, index) => ({
      id: `${SPACER_PREFIX}-${index}`,
      text: '',
      start: day,
      end: addDays(day, 1),
      type: 'task' as const,
    }));
    return [...rows, ...spacers];
  }, [activities, trailingRows, range.from]);

  const columns: IColumnConfig[] = useMemo(
    () => [
      { id: 'text', header: t('activity.fields.name'), width: 180, flexgrow: 1, cell: TextCell },
      { id: 'specialty', header: t('activity.fields.specialty'), width: 140, cell: SpecialtyCell },
      { id: 'responsible', header: t('activity.fields.responsible'), width: 140, cell: ResponsibleCell },
      { id: 'status', header: t('activity.fields.status'), width: 140, cell: StatusCell },
    ],
    [t],
  );

  const { scales, cellWidth } = useMemo(() => {
    const label = (pattern: string) => (date: Date) => format(date, pattern, { locale: dateLocale });
    switch (zoom) {
      case 'weeks':
        return {
          cellWidth: 96,
          scales: [
            { unit: 'month', step: 1, format: label('MMMM yyyy') },
            { unit: 'week', step: 1, format: label('d MMM') },
          ],
        };
      case 'months':
        return {
          cellWidth: 110,
          scales: [
            { unit: 'year', step: 1, format: label('yyyy') },
            { unit: 'month', step: 1, format: label('MMM') },
          ],
        };
      case 'quarters':
        return {
          cellWidth: 180,
          scales: [
            { unit: 'year', step: 1, format: label('yyyy') },
            { unit: 'quarter', step: 1, format: label('QQQ') },
          ],
        };
      default:
        return {
          cellWidth: 32,
          scales: [
            { unit: 'month', step: 1, format: label('MMMM yyyy') },
            { unit: 'day', step: 1, format: label('d') },
          ],
        };
    }
  }, [zoom, dateLocale]);

  // El diagrama muestra meses (o trimestres) enteros. Con el rango pegado a la
  // primera y la última tarea, el mes de la punta puede ser un solo día de
  // ancho —una obra que arranca el 31— y su rótulo ("julio 2026") no entra:
  // se corta en la columna.
  const { chartStart, chartEnd } = useMemo(() => {
    const from = fromDayKey(range.from);
    const to = fromDayKey(range.to);
    return zoom === 'quarters'
      ? { chartStart: startOfQuarter(from), chartEnd: startOfQuarter(addQuarters(to, 1)) }
      : { chartStart: startOfMonth(from), chartEnd: startOfMonth(addMonths(to, 1)) };
  }, [range.from, range.to, zoom]);

  const handleInit = useCallback((api: IApi) => {
    apiRef.current = api;
    api.on('select-task', ({ id }: { id: string | number }) => {
      if (!String(id).startsWith(SPACER_PREFIX)) selectRef.current(String(id));
    });

    for (const action of BLOCKED_ACTIONS) api.intercept(action, () => false);

    // `inProgress` es el arrastre en curso: sólo importa dónde se suelta.
    api.on(
      'update-task',
      ({ id, task, inProgress }: { id: string | number; task: { start?: Date; end?: Date }; inProgress?: boolean }) => {
        if (inProgress || !task.start || !task.end) return;
        const activity = activitiesRef.current.find((candidate) => candidate.id === String(id));
        if (!activity) return;

        const startDate = toDayKey(task.start);
        const endDate = toDayKey(addDays(task.end, -1));
        // Mover sólo el relleno de progreso no cambia fechas: no hay nada que guardar.
        if (startDate === activity.startDate && endDate === activity.endDate) return;
        rescheduleRef.current?.(activity.id, startDate, endDate);
      },
    );
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        // Las líneas de la grilla están en `index.css` (`.luma-gantt`).
        // Una superficie blanca como una card: el diagrama no flota sobre el lienzo gris. Con la
        // mitad del radio de una card (`rounded-3xl`, 28px): `rounded-lg`, 14px. Un diagrama ocupa
        // el ancho entero y una curva grande se come las esquinas de la tabla y de la escala.
        'luma-gantt min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-card shadow-surface [&_.wx-theme]:h-full',
        // La columna de hoy, en el verde de la marca y apenas teñida.
        '[&_.luma-gantt-today]:bg-primary/20',
        // El avance sale del estado: no se arrastra.
        '[&_.wx-progress-marker]:hidden',
      )}
    >
      {/* Claro: el área de contenido del panel lo es. El oscuro dejaba barras de scroll y filas negras sobre el lienzo. */}
      <Willow fonts={false}>
        <Gantt
          tasks={tasks}
          links={[]}
          scales={scales}
          highlightTime={highlightToday}
          columns={columns}
          start={chartStart}
          end={chartEnd}
          cellWidth={cellWidth}
          cellHeight={40}
          cellBorders="full"
          gridWidth={580}
          readonly={!onReschedule}
          init={handleInit}
        />
      </Willow>
    </div>
  );
}

export default ActivityGantt;
