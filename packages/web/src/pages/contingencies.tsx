import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import {
  CONTINGENCY_STATUS_LABELS,
  createContingencySchema,
  formatCurrency,
  type Contingency,
  type ContingencyStatus,
} from '@luma/shared';
import {
  useActivities,
  useBudgetStatus,
  useContingencies,
  useContingency,
  useContingencyAction,
  useCreateContingency,
} from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { ROUTES, contingencyPath } from '@/lib/routes';
import { formatDate } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
} from '@/components/ui';

const STATUS_TONE: Record<ContingencyStatus, 'neutral' | 'warning' | 'danger' | 'healthy' | 'info'> = {
  draft: 'neutral',
  pending_internal: 'warning',
  internal_approved: 'info',
  sent_to_client: 'warning',
  client_approved: 'healthy',
  client_rejected: 'danger',
  alternative_requested: 'warning',
  cancelled: 'neutral',
};

export function ContingenciesPage() {
  const { data: list, isLoading } = useContingencies();
  const { can } = useAuth();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Imprevistos</h1>
          <p className="text-sm text-muted-foreground">
            Todo sobrecosto sale con causa, impacto y una decisión concreta
          </p>
        </div>
        {can('contingency.create') && (
          <Link
            to={ROUTES.CONTINGENCY_NEW}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            Registrar
          </Link>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : !list || list.length === 0 ? (
        <EmptyState
          title="No hay imprevistos registrados"
          description="Cuando aparezca uno, registralo apenas se detecte: la alerta temprana molesta menos que el hecho consumado."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((item) => (
            <li key={item.id}>
              <Link to={contingencyPath(item.id)} className="block">
                <Card className="transition-colors hover:bg-muted">
                  <CardContent className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{item.code}</p>
                        <p className="truncate font-medium">{item.what_happened}</p>
                      </div>
                      <Badge tone={STATUS_TONE[item.status]}>
                        {CONTINGENCY_STATUS_LABELS[item.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.impact_cost)}
                      {item.impact_days > 0 && ` · ${item.impact_days} día(s)`}
                      {item.urgency === 'blocking' && ' · detiene la obra'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * RF-07: la estructura obligatoria.
 *
 * "Por qué pasó" es campo requerido y el texto de ayuda lo explica, porque un
 * asistente apurado necesita saber para qué se lo estamos pidiendo — es lo que
 * convierte un cobro en una explicación.
 */
export function NewContingencyPage() {
  const navigate = useNavigate();
  const create = useCreateContingency();
  const { data: activities } = useActivities();
  const { role } = useAuth();

  const [form, setForm] = useState({
    what_happened: '',
    why_happened: '',
    impact_cost: 0,
    impact_days: 0,
    urgency: 'non_blocking' as 'blocking' | 'non_blocking',
    affected_activity_ids: [] as string[],
  });
  const [option, setOption] = useState({ description: '', cost: 0, days: 0 });
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Registrar imprevisto</h1>
        <p className="text-sm text-muted-foreground">
          {role === 'assistant'
            ? 'Queda como borrador: el encargado lo revisa antes de que llegue al cliente.'
            : 'Pasa a revisión interna. Nada llega al cliente sin aprobación.'}
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);

              const payload = {
                ...form,
                options: option.description ? [option] : [],
                evidence: [],
              };
              const parsed = createContingencySchema.safeParse(payload);
              if (!parsed.success) {
                setError(parsed.error.errors[0].message);
                return;
              }

              create.mutate(
                { ...parsed.data, submit: role !== 'assistant' },
                {
                  onSuccess: (created) => navigate(contingencyPath(created.id)),
                  onError: (err) =>
                    setError(err instanceof Error ? err.message : 'No se pudo registrar'),
                },
              );
            }}
          >
            <Field label="¿Qué pasó?" hint="En lenguaje simple, como se lo contarías a alguien.">
              <Textarea
                value={form.what_happened}
                onChange={(e) => setForm({ ...form, what_happened: e.target.value })}
                placeholder="Hacen falta 3 m3 más de arena de los calculados."
              />
            </Field>

            <Field
              label="¿Por qué pasó?"
              hint="Obligatorio. Es la causa lo que convierte un cobro en una explicación."
            >
              <Textarea
                value={form.why_happened}
                onChange={(e) => setForm({ ...form, why_happened: e.target.value })}
                placeholder="El nivel del piso existente estaba 4 cm más bajo de lo relevado."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Impacto en costo">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.impact_cost}
                  onChange={(e) => setForm({ ...form, impact_cost: Number(e.target.value) })}
                />
              </Field>
              <Field label="Impacto en días">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.impact_days}
                  onChange={(e) => setForm({ ...form, impact_days: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Urgencia">
              <Select
                value={form.urgency}
                onChange={(e) =>
                  setForm({ ...form, urgency: e.target.value as 'blocking' | 'non_blocking' })
                }
              >
                <option value="non_blocking">No detiene la obra</option>
                <option value="blocking">Detiene la obra</option>
              </Select>
            </Field>

            <Field label="Actividades afectadas" hint="Si el imprevisto suma días, estas actividades se corren solas al aprobarse.">
              <Select
                multiple
                className="h-auto min-h-24"
                value={form.affected_activity_ids}
                onChange={(e) =>
                  setForm({
                    ...form,
                    affected_activity_ids: [...e.target.selectedOptions].map((o) => o.value),
                  })
                }
              >
                {activities?.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset className="rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">Alternativa (opcional)</legend>
              <p className="mb-3 text-xs text-muted-foreground">
                Cuando exista una opción más barata, ofrecerla cambia la conversación: el cliente
                decide entre dos caminos en lugar de aceptar o pelear un sobrecosto.
              </p>
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Usar arena de río en la capa inferior"
                  value={option.description}
                  onChange={(e) => setOption({ ...option, description: e.target.value })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Costo"
                    value={option.cost}
                    onChange={(e) => setOption({ ...option, cost: Number(e.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Días"
                    value={option.days}
                    onChange={(e) => setOption({ ...option, days: Number(e.target.value) })}
                  />
                </div>
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Spinner /> : 'Registrar'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.CONTINGENCIES)}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/** Detalle con el flujo del RF-08 y el historial inmutable. */
export function ContingencyDetailPage() {
  const { id = '' } = useParams();
  const { data: item, isLoading } = useContingency(id);
  const { data: budget } = useBudgetStatus();
  const action = useContingencyAction();
  const { can } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (!item) return <EmptyState title="No encontramos ese imprevisto" />;

  const money = (n: number) => formatCurrency(n, budget?.currency ?? 'ARS');

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{item.code}</p>
          <h1 className="text-xl font-semibold tracking-tight">{item.what_happened}</h1>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{CONTINGENCY_STATUS_LABELS[item.status]}</Badge>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          <Block label="Por qué pasó" value={item.why_happened} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Block label="Impacto en costo" value={money(item.impact_cost)} />
            <Block label="Impacto en plazo" value={`${item.impact_days} día(s)`} />
          </div>
          {item.urgency === 'blocking' && (
            <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              Detiene la obra
              {item.blocking_since && ` desde el ${formatDate(item.blocking_since)}`}.
            </p>
          )}

          {/* El sobrecosto SIEMPRE contra el total y el saldo, nunca aislado. */}
          {budget && can('budget.view.full') && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                Sobre una línea base de <strong>{money(budget.baseline)}</strong>, si esto se
                aprueba quedarían{' '}
                <strong>{money(Math.max(budget.available - item.impact_cost, 0))}</strong>{' '}
                disponibles.
              </p>
            </div>
          )}

          {item.options.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Alternativas</p>
              <ul className="flex flex-col gap-2">
                {item.options.map((opt, index) => (
                  <li
                    key={index}
                    className="flex items-baseline justify-between gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <span>{opt.description}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {money(opt.cost)}
                      {opt.days > 0 && ` · ${opt.days}d`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <ContingencyActions item={item} onAction={action} />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {item.history.map((entry, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <span>
                  <span className="font-medium">
                    {CONTINGENCY_STATUS_LABELS[entry.to_status]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {entry.by_name ? `${entry.by_name} · ` : ''}
                    {formatDate(entry.at, {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {entry.comment && <span className="block text-xs">{entry.comment}</span>}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function ContingencyActions({
  item,
  onAction,
}: {
  item: Contingency;
  onAction: ReturnType<typeof useContingencyAction>;
}) {
  const { can } = useAuth();
  const [comment, setComment] = useState('');

  if (can('contingency.approve_internal')) {
    if (item.status === 'pending_internal') {
      return (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <p className="text-sm text-muted-foreground">
              Revisá las cifras. Al aprobar, todavía no se comunica: el envío al cliente es un
              paso aparte.
            </p>
            <Button
              disabled={onAction.isPending}
              onClick={() => onAction.mutate({ id: item.id, action: 'approve-internal' })}
            >
              {onAction.isPending ? <Spinner /> : 'Aprobar internamente'}
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (item.status === 'internal_approved') {
      return (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5">
            <p className="text-sm text-muted-foreground">
              El cliente va a recibir qué pasó, por qué, cuánto implica y el saldo que le queda.
            </p>
            <Button
              disabled={onAction.isPending}
              onClick={() => onAction.mutate({ id: item.id, action: 'send-to-client' })}
            >
              {onAction.isPending ? <Spinner /> : 'Comunicar al cliente'}
            </Button>
          </CardContent>
        </Card>
      );
    }
  }

  if (can('contingency.decide_client') && item.status === 'sent_to_client') {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5">
          <p className="text-sm font-medium">Tu decisión</p>
          <Textarea
            placeholder="Comentario (obligatorio si pedís una alternativa)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={onAction.isPending}
              onClick={() =>
                onAction.mutate({
                  id: item.id,
                  action: 'decision',
                  payload: { decision: 'approved', comment },
                })
              }
            >
              Aprobar
            </Button>
            <Button
              variant="outline"
              disabled={onAction.isPending}
              onClick={() =>
                onAction.mutate({
                  id: item.id,
                  action: 'decision',
                  payload: { decision: 'alternative', comment },
                })
              }
            >
              Pedir alternativa
            </Button>
            <Button
              variant="destructive"
              disabled={onAction.isPending}
              onClick={() =>
                onAction.mutate({
                  id: item.id,
                  action: 'decision',
                  payload: { decision: 'rejected', comment },
                })
              }
            >
              Rechazar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (can('contingency.create') && item.status === 'draft') {
    return (
      <Button
        disabled={onAction.isPending}
        onClick={() => onAction.mutate({ id: item.id, action: 'submit' })}
      >
        {onAction.isPending ? <Spinner /> : 'Enviar a revisión interna'}
      </Button>
    );
  }

  return null;
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
