import { Link } from 'react-router-dom';
import {
  ACTIVITY_STATUS_LABELS,
  currentWeekKey,
  formatCurrency,
  type BudgetHealth,
} from '@luma/shared';
import { useDashboard } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { ROUTES } from '@/lib/routes';
import { formatDate } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Spinner,
} from '@/components/ui';

const HEALTH_TONE: Record<BudgetHealth, 'healthy' | 'warning' | 'danger'> = {
  healthy: 'healthy',
  warning: 'warning',
  danger: 'danger',
};

/**
 * §3: el panel responde a una sola pregunta — cómo va la obra hoy y qué
 * requiere mi atención.
 *
 * El orden de la pantalla es el orden de la urgencia: primero lo que está
 * frenado o esperando una decisión, después el avance, y al final la plata.
 * No es estético: quien abre esto está parado en la obra.
 */
export function DashboardPage() {
  const { data, isLoading, error } = useDashboard();
  const { can } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="No pudimos cargar el panel"
        description={error instanceof Error ? error.message : undefined}
      />
    );
  }

  const money = (n: number) => formatCurrency(n, data.budget.currency);
  const attention: Array<{ label: string; detail: string; to: string; tone: 'danger' | 'warning' }> =
    [];

  if (data.contingencies.pending_internal > 0) {
    attention.push({
      label: `${data.contingencies.pending_internal} imprevisto(s) esperan tu revisión`,
      detail: 'Nada llega al cliente sin que lo apruebes.',
      to: ROUTES.CONTINGENCIES,
      tone: 'danger',
    });
  }
  if (data.contingencies.awaiting_client > 0) {
    attention.push({
      label: `${data.contingencies.awaiting_client} esperan respuesta del cliente`,
      detail:
        data.contingencies.oldest_awaiting_days !== null
          ? `El más viejo lleva ${data.contingencies.oldest_awaiting_days} día(s).`
          : '',
      to: ROUTES.CONTINGENCIES,
      tone: 'warning',
    });
  }
  if (data.materials.blocking > 0) {
    attention.push({
      label: `${data.materials.blocking} material(es) frenan actividades`,
      detail: `${money(data.materials.estimated_pending_cost)} estimados en compras pendientes.`,
      to: ROUTES.MATERIALS,
      tone: 'danger',
    });
  }
  if (data.personnel.deficit > 0) {
    attention.push({
      label: `Faltan ${data.personnel.deficit} persona(s) hoy`,
      detail: `${data.personnel.present_today} presentes de ${data.personnel.expected_today} esperados.`,
      to: ROUTES.PERSONNEL,
      tone: 'warning',
    });
  }
  if (data.activities.late > 0) {
    attention.push({
      label: `${data.activities.late} actividad(es) atrasadas`,
      detail: 'Ya pasó la fecha de fin planificada.',
      to: ROUTES.PLANNING,
      tone: 'warning',
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{data.project.name}</h1>
        <p className="text-sm text-muted-foreground">
          Semana {data.week.replace('-W', ' · semana ')}
        </p>
      </header>

      {/* Lo que requiere atención va PRIMERO. */}
      {attention.length > 0 && (
        <section className="flex flex-col gap-2">
          {attention.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  item.tone === 'danger' ? 'bg-danger' : 'bg-warning'
                }`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                {item.detail && (
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                )}
              </span>
            </Link>
          ))}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Avance general</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold tabular-nums">{data.progress_pct}%</p>
            <Progress value={data.progress_pct} tone="info" />
            <p className="text-sm text-muted-foreground">
              {data.activities.done} de {data.activities.total} actividades listas
              {data.activities.blocked > 0 && ` · ${data.activities.blocked} bloqueadas`}
            </p>
          </CardContent>
        </Card>

        {can('budget.view.full') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                Presupuesto
                <Badge tone={HEALTH_TONE[data.budget.health]}>
                  {data.budget.health === 'healthy'
                    ? 'En regla'
                    : data.budget.health === 'warning'
                      ? 'Atención'
                      : 'Desvío'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row label="Línea base" value={money(data.budget.baseline)} />
              <Row label="Ejecutado" value={money(data.budget.executed)} />
              <Row label="Comprometido" value={money(data.budget.committed)} />
              <Row label="Disponible" value={money(data.budget.available)} strong />
              {/* El margen de maniobra es EL número del ejecutante: cuánta
                  holgura le queda antes de comerse su rentabilidad. */}
              <div className="mt-1 rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Margen de maniobra</p>
                <p className="text-lg font-semibold tabular-nums">
                  {money(data.budget.maneuver_margin)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({data.budget.maneuver_margin_pct}%)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Esta semana</CardTitle>
        </CardHeader>
        <CardContent>
          {data.activities.this_week.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay actividades planificadas para {currentWeekKey()}.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.activities.this_week.map((activity) => (
                <li key={activity.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{activity.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.area ? `${activity.area} · ` : ''}
                      hasta {formatDate(activity.planned_end)}
                      {activity.blocking_materials > 0 &&
                        ` · ${activity.blocking_materials} material(es) faltante(s)`}
                    </p>
                    {activity.blocked_reason && (
                      <p className="mt-1 text-xs text-danger">{activity.blocked_reason}</p>
                    )}
                  </div>
                  <Badge
                    tone={
                      activity.status === 'done'
                        ? 'healthy'
                        : activity.status === 'blocked'
                          ? 'danger'
                          : activity.is_late
                            ? 'warning'
                            : 'neutral'
                    }
                  >
                    {activity.is_late && activity.status !== 'done'
                      ? 'Atrasada'
                      : ACTIVITY_STATUS_LABELS[activity.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* RF-10: la previsión, que es lo que los ejecutantes más valoran. */}
      {can('budget.view.full') && (
        <Card>
          <CardHeader>
            <CardTitle>Si sigue este ritmo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row
              label="Cierre proyectado del presupuesto"
              value={money(data.forecast.projected_budget_close)}
              strong
            />
            <Row
              label="Desvío proyectado"
              value={`${data.forecast.projected_budget_deviation >= 0 ? '+' : ''}${money(
                data.forecast.projected_budget_deviation,
              )}`}
            />
            {data.forecast.projected_end_date && (
              <Row
                label="Fecha de fin proyectada"
                value={`${formatDate(data.forecast.projected_end_date, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}${
                  data.forecast.projected_delay_days
                    ? ` (+${data.forecast.projected_delay_days} días)`
                    : ''
                }`}
              />
            )}
            {data.forecast.alerts.length > 0 && (
              <ul className="mt-1 flex flex-col gap-2">
                {data.forecast.alerts.map((alert, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        alert.severity === 'danger'
                          ? 'bg-danger'
                          : alert.severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-info'
                      }`}
                    />
                    <span className="text-muted-foreground">{alert.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}
