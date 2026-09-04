import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  currentWeekKey,
  shiftWeek,
  weekRange,
  type ActivityStatus,
} from '@luma/shared';
import { useActivities, useCreateActivity, useUpdateActivityStatus } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { formatDate } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';

/**
 * RF-01 y RF-04.
 *
 * La semana es la unidad, con navegación anterior/actual/siguiente. El cambio
 * de estado está en la fila, a un toque: es la acción más frecuente del
 * producto y meterla dentro de un detalle costaría dos toques más, todos los
 * días, a la persona que menos paciencia tiene con la herramienta.
 */
export function PlanningPage() {
  const [week, setWeek] = useState(currentWeekKey());
  const [showForm, setShowForm] = useState(false);
  const { data: activities, isLoading } = useActivities(week);
  const updateStatus = useUpdateActivityStatus();
  const { can } = useAuth();

  const { start, end } = weekRange(week);
  const isCurrent = week === currentWeekKey();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Planificación</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(start)} – {formatDate(end)}
            {isCurrent && ' · semana en curso'}
          </p>
        </div>
        {can('planning.manage') && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Nueva actividad
          </Button>
        )}
      </header>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeek(shiftWeek(week, -1))}>
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant={isCurrent ? 'subtle' : 'outline'}
          size="sm"
          onClick={() => setWeek(currentWeekKey())}
        >
          Semana actual
        </Button>
        <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setWeek(shiftWeek(week, 1))}>
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {showForm && can('planning.manage') && (
        <NewActivityForm week={week} onDone={() => setShowForm(false)} />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : !activities || activities.length === 0 ? (
        <EmptyState
          title="No hay actividades esta semana"
          description="Agregá las tareas que se van a ejecutar para poder seguir el avance."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{activity.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.area ? `${activity.area} · ` : ''}
                        {formatDate(activity.planned_start)} – {formatDate(activity.planned_end)}
                        {activity.planned_headcount > 0 &&
                          ` · ${activity.planned_headcount} persona(s)`}
                      </p>
                    </div>
                    {activity.is_late && activity.status !== 'done' && (
                      <Badge tone="warning">Atrasada</Badge>
                    )}
                  </div>

                  {activity.blocking_materials > 0 && (
                    <p className="rounded-sm bg-danger/10 px-2.5 py-1.5 text-xs text-danger">
                      {activity.blocking_materials} material(es) pendiente(s) bloquean esta
                      actividad.
                    </p>
                  )}
                  {activity.blocked_reason && (
                    <p className="text-xs text-danger">Bloqueada: {activity.blocked_reason}</p>
                  )}

                  {can('planning.update_status') && (
                    <div className="flex flex-wrap gap-2">
                      {ACTIVITY_STATUSES.map((status) => (
                        <StatusChip
                          key={status}
                          status={status}
                          active={activity.status === status}
                          disabled={updateStatus.isPending}
                          onSelect={() => {
                            // Un bloqueo sin motivo es el dato que después
                            // nadie puede explicarle al cliente. Se pide acá,
                            // y el backend lo exige igual.
                            const reason =
                              status === 'blocked'
                                ? window.prompt('¿Por qué está bloqueada?')
                                : undefined;
                            if (status === 'blocked' && !reason) return;
                            updateStatus.mutate({
                              id: activity.id,
                              status,
                              blocked_reason: reason ?? undefined,
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusChip({
  status,
  active,
  disabled,
  onSelect,
}: {
  status: ActivityStatus;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const tone =
    status === 'done'
      ? 'border-healthy text-healthy'
      : status === 'blocked'
        ? 'border-danger text-danger'
        : status === 'in_progress'
          ? 'border-info text-info'
          : 'border-border text-muted-foreground';

  return (
    <button
      type="button"
      disabled={disabled || active}
      onClick={onSelect}
      aria-pressed={active}
      className={`h-9 rounded-full border px-3.5 text-xs font-medium transition-colors disabled:opacity-100 ${
        active ? `${tone} bg-muted` : 'border-border text-muted-foreground hover:bg-muted'
      }`}
    >
      {ACTIVITY_STATUS_LABELS[status]}
    </button>
  );
}

function NewActivityForm({ week, onDone }: { week: string; onDone: () => void }) {
  const create = useCreateActivity();
  const { start, end } = weekRange(week);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: '',
    area: '',
    planned_start: iso(start),
    planned_end: iso(end),
    planned_headcount: 0,
    weight: 1,
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            create.mutate(
              { ...form, area: form.area || undefined },
              {
                onSuccess: onDone,
                onError: (err) =>
                  setError(err instanceof Error ? err.message : 'No se pudo crear'),
              },
            );
          }}
        >
          <div className="sm:col-span-2">
            <Field label="Actividad">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Colocación de porcelanato"
              />
            </Field>
          </div>
          <Field label="Área o espacio">
            <Input
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="Baño principal"
            />
          </Field>
          <Field label="Personal previsto">
            <Input
              type="number"
              min={0}
              value={form.planned_headcount}
              onChange={(e) => setForm({ ...form, planned_headcount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Inicio">
            <Input
              type="date"
              value={form.planned_start}
              onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
            />
          </Field>
          <Field label="Fin">
            <Input
              type="date"
              value={form.planned_end}
              onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
            />
          </Field>
          <Field
            label="Ponderación"
            hint="Cuánto pesa en el avance general. Dejalo en 1 si no querés ponderar."
          >
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : 'Agregar'}
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
