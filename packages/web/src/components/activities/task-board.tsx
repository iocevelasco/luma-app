import { useMemo, useState, type DragEvent } from 'react';
import { format } from 'date-fns';
import type { Activity, ActivityStatus } from '@luma/shared';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { CrewRosterDialog } from '@/components/crew/crew-roster-dialog';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useAllActivities,
  useCreateActivity,
  useDeleteActivity,
  useMoveActivity,
  useRejectActivity,
} from '@/hooks/activities/use-activity-queries';
import { useAssignableCrew, useCrewMembers } from '@/hooks/crew/use-crew-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { crewOptionLabel } from '@/lib/assignable-crew';
import { errorMessage } from '@/lib/error-message';
import {
  allowedMoves,
  layoutTasks,
  TASK_COLUMNS,
  taskPeople,
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

/** Lo que viaja en el arrastre. Safari no arranca un drag sin `setData`. */
const DRAG_TYPE = 'text/plain';

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
 * Una tarjeta del Tablero. Se mueve de dos formas que hacen lo mismo:
 *
 * - **Arrastrándola**, en desktop.
 * - **Desde su menú**, que es el camino de verdad: el arrastre táctil es
 *   frágil en Safari/iOS, y el supervisor opera desde el teléfono.
 *
 * El menú sólo ofrece lo que el rol puede hacer (`allowedMoves`, la misma
 * regla que aplica la API): un movimiento que termina en 403 es peor que no
 * ofrecerlo.
 */
function TaskCard({
  task,
  moves,
  canReject,
  canDelete,
  isDragging,
  onMove,
  onReject,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  task: Activity;
  moves: ActivityStatus[];
  canReject: boolean;
  canDelete: boolean;
  isDragging: boolean;
  onMove: (status: ActivityStatus) => void;
  onReject: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const draggable = moves.some((status) => status !== 'cancelada');
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

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-label={task.name}
      className={cn(
        'flex items-start justify-between gap-2 rounded-lg border border-border bg-background p-3',
        draggable && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm break-words">{task.name}</p>
        <p className="truncate text-xs text-muted-foreground">{task.responsible.name}</p>
        <p className={cn('text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
          {dates}
          {overdue && ` · ${t('task.board.overdue')}`}
        </p>
        {returnedReason && (
          <p className="text-xs text-destructive">
            {t('task.board.returned', { reason: returnedReason })}
          </p>
        )}
      </div>

      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 border-transparent"
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
      )}
    </article>
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
 * - En la semana en curso entran también las atrasadas de antes.
 * - Las canceladas no son columna: se ven aparte, a pedido.
 * - En el celular las columnas pasan a pestañas.
 * - Quién mueve qué sale de la grilla de permisos: el supervisor crea y mueve
 *   por el flujo; aprobar, devolver, cancelar y borrar es del gerente.
 */
export function TaskBoard({
  projectId,
  rosterOpen,
  onRosterOpenChange,
}: {
  projectId: string;
  /**
   * El diálogo de "Personal fijo" lo abre un botón que vive en la barra de
   * acciones de la pantalla, no acá: las acciones van todas en el mismo lugar.
   */
  rosterOpen: boolean;
  onRosterOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { can } = useProjectCapabilities(projectId);
  const [week, setWeek] = useState<WeekRange>(() => currentWeekRange());
  const [filter, setFilter] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState<TaskColumn>('pendiente');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [dragging, setDragging] = useState<Activity | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskColumn | null>(null);
  const [rejecting, setRejecting] = useState<Activity | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleting, setDeleting] = useState<Activity | null>(null);

  const isCurrentWeek = isSameWeek(week, currentWeekRange());
  const today = toDayKey(new Date());
  const { data: activitiesData } = useAllActivities(projectId);
  const { data: crewData } = useCrewMembers(projectId);
  const moveActivity = useMoveActivity(projectId);
  const rejectActivity = useRejectActivity(projectId);
  const deleteActivity = useDeleteActivity(projectId);

  const tasks = useMemo(
    () =>
      tasksForWeek(activitiesData?.activities ?? [], week, { includeOverdue: isCurrentWeek }),
    [activitiesData, week, isCurrentWeek],
  );
  const people = useMemo(() => taskPeople(tasks), [tasks]);
  // Si la persona filtrada ya no tiene tareas en esta semana, el filtro se
  // suelta solo: un tablero vacío por un filtro invisible parece un error.
  const activeFilter = people.some((person) => person.key === filter) ? filter : null;
  const layout = useMemo(
    () => layoutTasks(tasks, activeFilter, today),
    [tasks, activeFilter, today],
  );

  const hasCrew = (crewData?.crewMembers.length ?? 0) > 0;
  const canCreate = can('activity.create');

  function move(task: Activity, status: ActivityStatus) {
    if (task.status === status) return;
    moveActivity.mutate({ activityId: task.id, status });
  }

  function canDropOn(column: TaskColumn) {
    return Boolean(dragging && allowedMoves(dragging.status, can).includes(column));
  }

  function renderCard(task: Activity) {
    return (
      <TaskCard
        key={task.id}
        task={task}
        moves={allowedMoves(task.status, can)}
        canReject={task.status === 'en_revision' && can('activity.review')}
        canDelete={can('activity.plan')}
        isDragging={dragging?.id === task.id}
        onMove={(status) => move(task, status)}
        onReject={() => {
          setRejectReason('');
          setRejecting(task);
        }}
        onDelete={() => setDeleting(task)}
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, task.id);
          event.dataTransfer.effectAllowed = 'move';
          setDragging(task);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDropTarget(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
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
      </div>

      {canCreate && crewData && !hasCrew && (
        <p className="text-sm text-muted-foreground">{t('task.board.needRoster')}</p>
      )}

      {people.length > 1 && (
        <div
          role="group"
          aria-label={t('task.board.filterLabel')}
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            size="sm"
            variant={activeFilter === null ? 'default' : 'outline'}
            aria-pressed={activeFilter === null}
            onClick={() => setFilter(null)}
          >
            {t('task.board.filterAll')}
          </Button>
          {people.map((person) => (
            <Button
              key={person.key}
              size="sm"
              variant={activeFilter === person.key ? 'default' : 'outline'}
              aria-pressed={activeFilter === person.key}
              onClick={() => setFilter(person.key)}
            >
              {person.name}
            </Button>
          ))}
        </div>
      )}

      <Tabs
        value={mobileColumn}
        onValueChange={(value) => setMobileColumn(value as TaskColumn)}
        className="md:hidden"
      >
        {/* Cuatro pestañas no entran en 375px: la tira se desplaza adentro. */}
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {TASK_COLUMNS.map((column) => (
            <TabsTrigger key={column} value={column}>
              {t(`activity.status.${column}`)} ({layout.columns[column].length})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_COLUMNS.map((column) => (
          <section
            key={column}
            aria-labelledby={`board-column-${column}`}
            onDragOver={(event) => {
              if (!canDropOn(column)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDropTarget(column);
            }}
            onDragLeave={(event) => {
              // `dragleave` también salta al pasar sobre una tarjeta hija: sólo
              // vale cuando el puntero sale de la columna.
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropTarget(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDropTarget(null);
              const task = tasks.find(
                (candidate) => candidate.id === event.dataTransfer.getData(DRAG_TYPE),
              );
              if (task && allowedMoves(task.status, can).includes(column)) move(task, column);
            }}
            className={cn(
              'flex min-h-40 flex-col gap-3 rounded-2xl border border-border bg-card p-3',
              column !== mobileColumn && 'hidden md:flex',
              dropTarget === column && 'border-primary ring-2 ring-primary/40',
            )}
          >
            <header className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <h3 id={`board-column-${column}`} className="text-sm font-medium">
                  {t(`activity.status.${column}`)}
                </h3>
                <Badge variant="secondary" className="tabular-nums">
                  {layout.columns[column].length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t(`task.board.hint.${column}`)}</p>
            </header>

            {column === 'pendiente' &&
              canCreate &&
              hasCrew &&
              (quickAddOpen ? (
                <QuickAddTask
                  projectId={projectId}
                  week={week}
                  onDone={() => setQuickAddOpen(false)}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => setQuickAddOpen(true)}
                >
                  <Plus className="size-4" />
                  {t('task.board.newTask')}
                </Button>
              ))}

            {layout.columns[column].length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">{t('task.board.emptyColumn')}</p>
            ) : (
              <div className="flex flex-col gap-2">{layout.columns[column].map(renderCard)}</div>
            )}
          </section>
        ))}
      </div>

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
              {layout.cancelled.map(renderCard)}
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

      <CrewRosterDialog
        projectId={projectId}
        isOwner={can('crew.manage')}
        open={rosterOpen}
        onOpenChange={onRosterOpenChange}
      />
    </div>
  );
}

export default TaskBoard;
