import { useState } from 'react';
import { formatCurrency } from '@luma/shared';
import { useClientDashboard, useContingencyAction } from '@/hooks';
import { formatDate } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Spinner,
  Textarea,
} from '@/components/ui';

/**
 * §2.4 y §5.5: la vista del cliente.
 *
 * Cuatro cosas y nada más: cuánto se avanzó, cómo va la plata, qué decisiones
 * dependen de él y por qué. Nada de asignación de personal, notas internas ni
 * listas de compras en borrador — no por ocultamiento, sino porque el cliente
 * necesita estar informado sin sentirse abrumado por detalle técnico.
 */
export function ClientViewPage() {
  const { data, isLoading } = useClientDashboard();
  const action = useContingencyAction();
  const [comments, setComments] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (!data) return <EmptyState title="No pudimos cargar tu obra" />;

  const money = (n: number) => formatCurrency(n, data.budget.currency);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{data.project.name}</h1>
        <p className="text-sm text-muted-foreground">Así viene tu obra</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Avance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-3xl font-semibold tabular-nums">{data.progress_pct}%</p>
          <Progress value={data.progress_pct} tone="info" />
          <p className="text-sm text-muted-foreground">
            {data.activities_done} de {data.activities_total} tareas terminadas
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            Presupuesto
            <Badge tone={data.budget.health}>
              {data.budget.health === 'healthy'
                ? 'Dentro de lo previsto'
                : data.budget.health === 'warning'
                  ? 'Atención'
                  : 'Con desvío'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Presupuesto acordado</span>
            <span className="tabular-nums">{money(data.budget.baseline)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Comprometido hasta hoy</span>
            <span className="tabular-nums">{money(data.budget.committed_total)}</span>
          </div>
          <div className="flex justify-between gap-3 font-semibold">
            <span>Queda</span>
            <span className="tabular-nums">{money(data.budget.remaining)}</span>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Esperando tu decisión</h2>

        {data.pending_decisions.length === 0 ? (
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">
                No hay nada pendiente de tu parte. Te avisamos apenas aparezca algo.
              </p>
            </CardContent>
          </Card>
        ) : (
          data.pending_decisions.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-4 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.what_happened}</p>
                  {item.urgency === 'blocking' && <Badge tone="danger">Frena la obra</Badge>}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Por qué pasó</p>
                  <p className="text-sm">{item.why_happened}</p>
                </div>

                {/* Nunca la cifra sola: siempre contra el total y el saldo. */}
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>
                    Costo adicional: <strong>{money(item.impact_cost)}</strong>
                    {item.impact_days > 0 && ` · ${item.impact_days} día(s) más de obra`}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Sobre {money(data.budget.baseline)} acordados, después de esto quedarían{' '}
                    {money(Math.max(data.budget.remaining - item.impact_cost, 0))}.
                  </p>
                </div>

                {item.options.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Otra opción</p>
                    <ul className="flex flex-col gap-2">
                      {item.options.map((option, index) => (
                        <li
                          key={index}
                          className="flex items-baseline justify-between gap-3 rounded-md border border-border p-3 text-sm"
                        >
                          <span>{option.description}</span>
                          <span className="shrink-0 tabular-nums">{money(option.cost)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.sent_to_client_at && (
                  <p className="text-xs text-muted-foreground">
                    Te lo enviamos el {formatDate(item.sent_to_client_at)}
                  </p>
                )}

                <Textarea
                  placeholder="Comentario (obligatorio si querés otra alternativa)"
                  value={comments[item.id] ?? ''}
                  onChange={(e) => setComments({ ...comments, [item.id]: e.target.value })}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: item.id,
                        action: 'decision',
                        payload: { decision: 'approved', comment: comments[item.id] },
                      })
                    }
                  >
                    Aprobar
                  </Button>
                  <Button
                    variant="outline"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: item.id,
                        action: 'decision',
                        payload: { decision: 'alternative', comment: comments[item.id] },
                      })
                    }
                  >
                    Quiero otra opción
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: item.id,
                        action: 'decision',
                        payload: { decision: 'rejected', comment: comments[item.id] },
                      })
                    }
                  >
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
