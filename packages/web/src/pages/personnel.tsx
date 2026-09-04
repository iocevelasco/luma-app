import { useEffect, useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { toDateKey } from '@luma/shared';
import { useActivities, useAttendance, useCreateWorker, useRecordAttendance, useWorkers } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
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
} from '@/components/ui';

/**
 * RF-03: parte diario.
 *
 * El estado del formulario arranca desde lo ya registrado y se manda entero en
 * un request. Con conectividad intermitente (§8), un POST por persona
 * significa un parte a medias cuando se corta la señal en el tercero.
 */
export function PersonnelPage() {
  const [date, setDate] = useState(toDateKey());
  const [showForm, setShowForm] = useState(false);
  const { data: attendance, isLoading } = useAttendance(date);
  const { data: workers } = useWorkers();
  const { data: activities } = useActivities();
  const record = useRecordAttendance();
  const { can } = useAuth();

  const [entries, setEntries] = useState<Record<string, { present: boolean; activity_id: string }>>({});

  useEffect(() => {
    if (!workers) return;
    const next: Record<string, { present: boolean; activity_id: string }> = {};
    for (const worker of workers) {
      const existing = attendance?.records.find((r) => r.worker_id === worker.id);
      next[worker.id] = {
        present: existing?.present ?? false,
        activity_id: existing?.activity_id ?? '',
      };
    }
    setEntries(next);
  }, [workers, attendance]);

  const presentCount = Object.values(entries).filter((e) => e.present).length;
  const deficit = Math.max((attendance?.expected ?? 0) - presentCount, 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Personal</h1>
          <p className="text-sm text-muted-foreground">Quién está hoy y en qué actividad</p>
        </div>
        {can('personnel.manage') && (
          <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Agregar persona
          </Button>
        )}
      </header>

      {showForm && can('personnel.manage') && <NewWorkerForm onDone={() => setShowForm(false)} />}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          aria-label="Fecha del parte"
          className="h-11 w-auto"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div className="flex gap-2">
          <Badge tone="info">{presentCount} presentes</Badge>
          <Badge tone="outline">{attendance?.expected ?? 0} esperados</Badge>
          {deficit > 0 && <Badge tone="warning">Faltan {deficit}</Badge>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : !workers || workers.length === 0 ? (
        <EmptyState
          title="Todavía no hay personal cargado"
          description="Agregá a las personas que trabajan en la obra para poder registrar la asistencia diaria."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {workers.map((worker) => {
              const entry = entries[worker.id] ?? { present: false, activity_id: '' };
              return (
                <li key={worker.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-medium">{worker.name}</p>
                        {worker.trade && (
                          <p className="text-xs text-muted-foreground">{worker.trade}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.present && (
                          <Select
                            aria-label={`Actividad de ${worker.name}`}
                            className="h-9 w-auto max-w-44 text-xs"
                            value={entry.activity_id}
                            onChange={(e) =>
                              setEntries({
                                ...entries,
                                [worker.id]: { ...entry, activity_id: e.target.value },
                              })
                            }
                          >
                            <option value="">Sin asignar</option>
                            {activities?.map((activity) => (
                              <option key={activity.id} value={activity.id}>
                                {activity.name}
                              </option>
                            ))}
                          </Select>
                        )}
                        <Button
                          type="button"
                          variant={entry.present ? 'default' : 'outline'}
                          size="sm"
                          aria-pressed={entry.present}
                          disabled={!can('personnel.manage')}
                          onClick={() =>
                            setEntries({
                              ...entries,
                              [worker.id]: { ...entry, present: !entry.present },
                            })
                          }
                        >
                          {entry.present ? 'Presente' : 'Ausente'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>

          {can('personnel.manage') && (
            <Button
              disabled={record.isPending}
              onClick={() =>
                record.mutate({
                  date,
                  entries: Object.entries(entries).map(([worker_id, entry]) => ({
                    worker_id,
                    present: entry.present,
                    activity_id: entry.activity_id || null,
                  })),
                })
              }
            >
              {record.isPending ? <Spinner /> : 'Guardar parte del día'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function NewWorkerForm({ onDone }: { onDone: () => void }) {
  const create = useCreateWorker();
  const [form, setForm] = useState({ name: '', trade: '' });

  return (
    <Card>
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ ...form, trade: form.trade || undefined }, { onSuccess: onDone });
          }}
        >
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Oficio">
            <Input
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
              placeholder="Albañil, plomero…"
            />
          </Field>
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
