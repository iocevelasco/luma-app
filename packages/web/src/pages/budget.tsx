import { useRef, useState } from 'react';
import { UploadIcon } from 'lucide-react';
import { formatCurrency, type BudgetHealth, type BudgetImportPreview } from '@luma/shared';
import { budgetApi } from '@/api';
import { useBudgetStatus, useCurrentBudget } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentProjectId } from '@/stores/session-store';
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
} from '@/components/ui';

const HEALTH_LABEL: Record<BudgetHealth, string> = {
  healthy: 'En regla',
  warning: 'Atención',
  danger: 'Desvío',
};

/**
 * RF-05.
 *
 * El presupuesto se IMPORTA, no se digita: es la vía principal de carga y
 * condiciona la adopción, porque evita rehacer un trabajo que el ejecutante ya
 * hizo al cotizar. Y se importa en dos pasos —vista previa, después
 * confirmación— porque lo que se carga queda como línea base y una línea base
 * mal cargada hace que todas las previsiones mientan.
 */
export function BudgetPage() {
  const { data: status, isLoading } = useBudgetStatus();
  const { data: budget } = useCurrentBudget();
  const { can } = useAuth();
  const [preview, setPreview] = useState<
    (BudgetImportPreview & { file_name?: string }) | null
  >(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  const money = (n: number) => formatCurrency(n, status?.currency ?? 'ARS');
  const hasBaseline = (status?.baseline ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground">
            Línea base, ejecución y margen de maniobra
          </p>
        </div>
        {can('budget.import') && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setError(null);
                setImporting(true);
                try {
                  setPreview(await budgetApi.preview(file));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No pudimos leer la planilla');
                } finally {
                  setImporting(false);
                  event.target.value = '';
                }
              }}
            />
            <Button size="sm" onClick={() => fileInput.current?.click()} disabled={importing}>
              {importing ? <Spinner /> : <UploadIcon className="h-4 w-4" aria-hidden />}
              {hasBaseline ? 'Cargar nueva versión' : 'Importar planilla'}
            </Button>
          </>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Vista previa antes de confirmar: totales, filas incompletas, unidades
          no reconocidas y duplicados. */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Revisá antes de confirmar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total detectado</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatCurrency(preview.total, preview.currency)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Capítulos</p>
                <p className="text-lg font-semibold tabular-nums">{preview.chapters.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Filas leídas</p>
                <p className="text-lg font-semibold tabular-nums">{preview.row_count}</p>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="mb-1.5 text-sm font-medium text-warning">
                  {preview.warnings.length} cosa(s) para revisar
                </p>
                <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
                  {preview.warnings.map((warning, index) => (
                    <li key={index}>{warning.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="flex flex-col divide-y divide-border text-sm">
              {preview.chapters.map((chapter) => (
                <li key={chapter.code} className="flex justify-between gap-3 py-2">
                  <span>
                    {chapter.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      ({chapter.items.length} ítems)
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(chapter.total, preview.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await budgetApi.confirm({
                    currency: preview.currency,
                    file_name: preview.file_name,
                    chapters: preview.chapters,
                  });
                  setPreview(null);
                  void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
                }}
              >
                Confirmar carga
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Descartar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!hasBaseline && !preview ? (
        <EmptyState
          title="Todavía no hay presupuesto cargado"
          description="Importá la planilla con la que cotizaste. La estructura de capítulos se convierte en la del proyecto y queda como línea base."
        />
      ) : (
        status && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    Estado
                    <Badge tone={status.health}>{HEALTH_LABEL[status.health]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <Row label="Línea base" value={money(status.baseline)} />
                  <Row label="Ejecutado" value={money(status.executed)} />
                  <Row label="Comprometido" value={money(status.committed)} />
                  <Row label="Disponible" value={money(status.available)} strong />
                  <Progress
                    value={
                      status.baseline
                        ? ((status.executed + status.committed) / status.baseline) * 100
                        : 0
                    }
                    tone={status.health}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Margen de maniobra</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <p className="text-3xl font-semibold tabular-nums">
                    {money(status.maneuver_margin)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status.maneuver_margin_pct}% de la línea base. Es la holgura que queda antes
                    de comprometer tu rentabilidad.
                  </p>
                </CardContent>
              </Card>
            </div>

            {status.by_chapter.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Por capítulo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y divide-border">
                    {status.by_chapter.map((chapter) => (
                      <li key={chapter.code} className="flex flex-col gap-1.5 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">{chapter.name}</span>
                          <Badge tone={chapter.health}>
                            {chapter.deviation_pct >= 0 ? '+' : ''}
                            {chapter.deviation_pct}%
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Presupuestado {money(chapter.baseline)}</span>
                          <span>
                            Usado {money(chapter.executed + chapter.committed)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {budget && (
              <p className="text-xs text-muted-foreground">
                Versión {budget.version}
                {budget.is_baseline ? ' (línea base)' : ''}
                {budget.file_name ? ` · ${budget.file_name}` : ''}
              </p>
            )}
          </>
        )
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
