import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Activity, ActivityStatus } from '@luma/shared';
import { CalendarRange, ChevronLeft, ChevronRight, Clock, MoreHorizontal, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { TaskKanban } from '@/components/activities/task-kanban';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ACTIVITY_STATUS_ICON } from '@/components/common/activity-status-icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateActivity,
  useDeleteActivity,
  useMoveActivity,
  useRejectActivity,
} from '@/hooks/activities/use-activity-queries';
import { useAssignableCrew, useCrewMembers } from '@/hooks/crew/use-crew-queries';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { crewOptionLabel } from '@/lib/assignable-crew';
import { initials } from '@/lib/initials';
import { errorMessage } from '@/lib/error-message';
import {
  allowedMoves,
  layoutTasks,
  TASK_COLUMNS,
  tasksForWeek,
  type TaskColumn,
} from '@/lib/task-board';
import { cn } from '@/lib/utils';
import {
  currentWeekRange,
  isActivityOverdue,
  isSameWeek,
  shiftWeek,
  type WeekRange,
} from '@/lib/week';

/**
 * Alta rápida, arriba de Pendiente: qué hay que hacer, quién, y hasta cuándo.
 * Crea una tarea completa —la misma que se ve en el Cronograma—:
 *
 * - arranca hoy si hoy cae en la semana que se está mirando; si no, el lunes;
 * - la persona queda de responsable y en la cuadrilla, que es lo que la lleva
 *   a la asistencia de la Jornada;
 * - la especialidad es la de la persona, o "otra".
 *
 * El "hasta" se elige acá porque después sólo el gerente puede modificarla.
 */
function QuickAddTask({
  projectId,
  week,
  onDone,
}: {
  projectId: string;
  week: WeekRange;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const today = toDayKey(new Date());
  const start = today >= week.from && today <= week.to ? today : week.from;
  const [name, setName] = useState('');
  const [crewMemberId, setCrewMemberId] = useState('');
  const [until, setUntil] = useState(start);
  const { members: crewMembers } = useAssignableCrew(projectId);
  const createActivity = useCreateActivity(projectId);

  const endDate = until && until >= start ? until : start;

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2"
      onSubmit={(event) => {
        event.preventDefault();
        const member = crewMembers.find((candidate) => candidate.id === crewMemberId);
        if (!member || !name.trim()) return;
        createActivity.mutate(
          {
            name: name.trim(),
            startDate: start,
            endDate,
            responsible: { name: member.name },
            specialty: member.specialty ?? 'otra',
            status: 'pendiente',
            crewMemberIds: [member.id],
          },
          // Queda abierto para cargar la siguiente: se suelen cargar varias
          // seguidas. Se conservan la persona y la fecha; el nombre no.
          { onSuccess: () => setName('') },
        );
      }}
    >
      <Input
        id="board-task-name"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('task.board.namePlaceholder')}
        aria-label={t('activity.fields.name')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone();
        }}
      />
      <Select value={crewMemberId} onValueChange={setCrewMemberId}>
        <SelectTrigger id="board-task-assignee" aria-label={t('task.board.assignee')}>
          <SelectValue placeholder={t('task.board.assigneePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {crewMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {crewOptionLabel(member, t('crew.kind.equipo'))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex flex-col gap-1">
        <Label htmlFor="board-task-end" className="text-xs text-muted-foreground">
          {t('task.board.until')}
        </Label>
        <Input
          id="board-task-end"
          type="date"
          min={start}
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
      </div>
      {createActivity.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(createActivity.error, t)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={createActivity.isPending || !crewMemberId || !name.trim()}
        >
          {t('task.board.quickAddSubmit')}
        </Button>
      </div>
    </form>
  );
}

/**
 * El aspecto de una tarjeta del Tablero, en el contenido y no en la caja de la
 * librería (ver `.luma-kanban` en `index.css`): oscura (`surface-dark` invierte
 * los tokens de adentro) y con el radio de un botón (`rounded-md`), un escalón abajo
 * del de la columna. Así se ve igual en
 * la columna, mientras se arrastra, en la lista del celular y en las canceladas.
 */
const TASK_CARD = 'luma-task-card surface-dark rounded-md p-3.5';

/**
 * El contenido de una tarjeta del Tablero. Se mueve de dos formas que hacen lo
 * mismo:
 *
 * - **Arrastrándola**, en escritorio (la librería del Tablero).
 * - **Desde su menú**, que es el camino de verdad en el teléfono: el
 *   supervisor opera desde ahí, y arrastrar una tarjeta con el dedo es
 *   frágil en Safari/iOS.
 *
 * El menú sólo ofrece lo que el rol puede hacer (`allowedMoves`, la misma
 * regla que aplica la API): un movimiento que termina en 403 es peor que no
 * ofrecerlo.
 */
function TaskCardContent({
  task,
  moves,
  canReject,
  canDelete,
  onMove,
  onReject,
  onDelete,
  onOpen,
}: {
  task: Activity;
  moves: ActivityStatus[];
  canReject: boolean;
  canDelete: boolean;
  onMove: (status: ActivityStatus) => void;
  onReject: () => void;
  onDelete: () => void;
  /** Abre el detalle. Sólo en la lista del celular: en escritorio lo hace la librería con el clic. */
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const overdue = isActivityOverdue(task.endDate, task.status);
  const returnedReason =
    task.status === 'en_curso' ? task.review?.rejectionReason : undefined;

  const day = (key: string) => format(fromDayKey(key), 'd MMM', { locale: dateLocale });
  const dates =
    task.startDate === task.endDate ? day(task.startDate) : `${day(task.startDate)} – ${day(task.endDate)}`;

  function moveLabel(status: ActivityStatus) {
    if (status === 'completada' && task.status === 'en_revision') return t('task.board.approve');
    if (status === 'cancelada') return t('task.board.cancel');
    if (task.status === 'cancelada') return t('task.board.restore');
    return t('task.board.moveTo', { column: t(`activity.status.${status}`) });
  }

  const hasMenu = moves.length > 0 || canReject || canDelete;

  const titleClass = 'text-sm font-medium leading-snug break-words';

  return (
    <div className="flex flex-col gap-2.5">
      {/*
        Arriba, qué es: el rubro como antetítulo y el nombre en `font-medium`.
        Es lo único que compite por la mirada; el resto va a un escalón menos
        (IA-9). El menú queda arriba a la derecha, fuera del camino del texto.
      */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {task.specialty && (
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {t(`provider.specialty.${task.specialty}`)}
            </span>
          )}
          {onOpen ? (
            <button type="button" onClick={onOpen} className={cn(titleClass, 'text-left hover:underline')}>
              {task.name}
            </button>
          ) : (
            <p className={titleClass}>{task.name}</p>
          )}
        </div>

        {hasMenu && (
          // El clic en el menú no es un clic en la tarjeta: no abre el detalle.
          <div onClick={(event) => event.stopPropagation()} className="-mr-1 -mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label={t('task.board.cardActions')}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {moves
                  .filter((status) => status !== 'cancelada')
                  .map((status) => (
                    <DropdownMenuItem key={status} onSelect={() => onMove(status)}>
                      {moveLabel(status)}
                    </DropdownMenuItem>
                  ))}
                {canReject && (
                  <DropdownMenuItem onSelect={onReject}>{t('activity.review.return')}</DropdownMenuItem>
                )}
                {(moves.includes('cancelada') || canDelete) && <DropdownMenuSeparator />}
                {moves.includes('cancelada') && (
                  <DropdownMenuItem onSelect={() => onMove('cancelada')}>
                    {moveLabel('cancelada')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    {t('task.board.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Lo que pide una acción de quien mira, en su propio bloque: el motivo de una devolución. */}
      {returnedReason && (
        <p className="rounded-md bg-destructive/15 px-2.5 py-1.5 text-xs text-destructive">
          {t('task.board.returned', { reason: returnedReason })}
        </p>
      )}

      {/* Abajo, los metadatos: quién (avatar y nombre) a la izquierda, cuándo a la derecha. */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-2xs">{initials(task.responsible.name)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{task.responsible.name}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          <CalendarRange aria-hidden className="size-3.5" />
          {dates}
        </span>
      </div>

      {/* El atraso es un hecho aparte del estado: un badge, no texto rojo suelto. */}
      {overdue && (
        <Badge variant="danger" icon={Clock} className="self-start py-0.5">
          {t('task.board.overdue')}
        </Badge>
      )}
    </div>
  );
}

/**
 * El Tablero de tareas de la semana: Pendiente, En curso, En revisión y
 * Completada.
 *
 * Una tarea ES una actividad: lo que se crea acá aparece en el Cronograma y
 * en la asistencia de la Jornada, y lo que se planifica en el Cronograma
 * aparece acá. El Cronograma es la vista de lejos (qué y cuándo); esto es la
 * de cerca (quién está en qué esta semana y cómo viene).
 *
 * Recibe las actividades **ya filtradas** por los filtros de la pantalla, que
 * son los mismos para el Cronograma y la Lista: este tablero no tiene filtros
 * propios.
 *
 * - En la semana en curso entran también las atrasadas de antes.
 * - Las canceladas no son columna: se ven aparte, a pedido.
 * - En escritorio las columnas son las de la librería del Tablero; en el
 *   celular pasan a pestañas, y las tarjetas se mueven desde su menú.
 * - Quién mueve qué sale de la grilla de permisos: el supervisor crea y mueve
 *   por el flujo; aprobar, devolver, cancelar y borrar es del gerente.
 */
export function TaskBoard({
  projectId,
  activities,
  onSelectActivity,
}: {
  projectId: string;
  /** Las actividades de la obra que pasan los filtros, de cualquier fecha. */
  activities: Activity[];
  onSelectActivity: (activityId: string) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const isMobile = useIsMobile();
  const { can } = useProjectCapabilities(projectId);
  const [week, setWeek] = useState<WeekRange>(() => currentWeekRange());
  const [mobileColumn, setMobileColumn] = useState<TaskColumn>('pendiente');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [rejecting, setRejecting] = useState<Activity | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState<Activity | null>(null);

  const isCurrentWeek = isSameWeek(week, currentWeekRange());
  const today = toDayKey(new Date());
  const { data: crewData } = useCrewMembers(projectId);
  const moveActivity = useMoveActivity(projectId);
  const rejectActivity = useRejectActivity(projectId);
  const deleteActivity = useDeleteActivity(projectId);

  const tasks = useMemo(
    () => tasksForWeek(activities, week, { includeOverdue: isCurrentWeek }),
    [activities, week, isCurrentWeek],
  );
  const layout = useMemo(() => layoutTasks(tasks, null, today), [tasks, today]);

  const hasCrew = (crewData?.crewMembers.length ?? 0) > 0;
  const canCreate = can('activity.create');

  function move(task: Activity, status: ActivityStatus) {
    if (task.status === status) return;
    moveActivity.mutate({ activityId: task.id, status });
  }

  function renderCardContent(task: Activity, onOpen?: () => void) {
    return (
      <TaskCardContent
        task={task}
        moves={allowedMoves(task.status, can)}
        canReject={task.status === 'en_revision' && can('activity.review')}
        canDelete={can('activity.plan')}
        onMove={(status) => move(task, status)}
        onReject={() => {
          setRejectReason('');
          setRejecting(task);
        }}
        onDelete={() => setDeleting(task)}
        onOpen={onOpen}
      />
    );
  }

  // Tarjeta de la lista del celular y de las canceladas: la librería sólo
  // dibuja las cuatro columnas.
  function renderListCard(task: Activity) {
    return (
      <article
        key={task.id}
        aria-label={task.name}
        className={TASK_CARD}
      >
        {renderCardContent(task, () => onSelectActivity(task.id))}
      </article>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeek((current) => shiftWeek(current, -1))}
            aria-label={t('task.board.prevWeek')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm">
            {format(fromDayKey(week.from), 'd MMM', { locale: dateLocale })} —{' '}
            {format(fromDayKey(week.to), 'd MMM', { locale: dateLocale })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeek((current) => shiftWeek(current, 1))}
            aria-label={t('task.board.nextWeek')}
          >
            <ChevronRight className="size-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" onClick={() => setWeek(currentWeekRange())}>
              {t('task.board.currentWeek')}
            </Button>
          )}
        </div>

        {canCreate && hasCrew && !quickAddOpen && (
          <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)}>
            <Plus className="size-4" />
            {t('task.board.quickAdd')}
          </Button>
        )}
      </div>

      {canCreate && crewData && !hasCrew && (
        <p className="text-sm text-muted-foreground">{t('task.board.needRoster')}</p>
      )}

      {canCreate && hasCrew && quickAddOpen && (
        <div className="max-w-sm">
          <QuickAddTask projectId={projectId} week={week} onDone={() => setQuickAddOpen(false)} />
        </div>
      )}

      {isMobile ? (
        <>
          <Tabs value={mobileColumn} onValueChange={(value) => setMobileColumn(value as TaskColumn)}>
            {/* Cuatro pestañas no entran en 375px: la tira se desplaza adentro. */}
            <TabsList className="max-w-full justify-start overflow-x-auto">
              {TASK_COLUMNS.map((column) => (
                <TabsTrigger key={column} value={column} icon={ACTIVITY_STATUS_ICON[column]}>
                  {t(`activity.status.${column}`)} ({layout.columns[column].length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <section
            aria-label={t(`activity.status.${mobileColumn}`)}
            className="luma-board-canvas flex min-h-40 flex-col gap-2 rounded-lg p-2"
          >
            {layout.columns[mobileColumn].length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">{t('task.board.emptyColumn')}</p>
            ) : (
              layout.columns[mobileColumn].map(renderListCard)
            )}
          </section>
        </>
      ) : (
        <TaskKanban
          layout={layout}
          canMoveTo={(task, column) => allowedMoves(task.status, can).includes(column)}
          onMove={move}
          onSelect={onSelectActivity}
          renderCard={(task) => (
            <article aria-label={task.name} className={TASK_CARD}>
              {renderCardContent(task)}
            </article>
          )}
        />
      )}

      {layout.cancelled.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={showCancelled}
            onClick={() => setShowCancelled((open) => !open)}
          >
            {showCancelled
              ? t('task.board.hideCancelled')
              : t('task.board.showCancelled', { count: layout.cancelled.length })}
          </Button>
          {showCancelled && (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {layout.cancelled.map(renderListCard)}
            </div>
          )}
        </div>
      )}

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('task.board.rejectTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="board-reject-reason">{t('activity.review.reasonLabel')}</Label>
            <Textarea
              id="board-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t('activity.review.reasonPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!rejectReason.trim() || rejectActivity.isPending}
              onClick={() =>
                rejecting &&
                rejectActivity.mutate(
                  { activityId: rejecting.id, reason: rejectReason.trim() },
                  { onSuccess: () => setRejecting(null) },
                )
              }
            >
              {t('activity.review.confirmReturn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('task.board.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('task.board.deleteBody', { name: deleting?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteActivity.mutate(deleting.id)}
            >
              {t('task.board.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TaskBoard;
