import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils';

/**
 * Rol de la columna en la tarjeta de celular. En desktop todas las columnas se
 * renderizan igual; esto sólo decide cómo se acomoda el dato cuando no hay
 * ancho para una tabla.
 *
 * - `primary`    → título de la tarjeta (una sola por tabla).
 * - `secondary`  → línea de apoyo, arriba a la derecha del título.
 * - `field`      → par etiqueta/valor apilado en el cuerpo.
 * - `actions`    → pie de la tarjeta, separado por una línea.
 * - `desktopOnly`→ se omite en celular (ruido en pantalla chica).
 */
export type ResponsiveColumnRole =
  | 'primary'
  | 'secondary'
  | 'field'
  | 'actions'
  | 'desktopOnly';

export interface ResponsiveColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  mobile?: ResponsiveColumnRole;
  headerClassName?: string;
  cellClassName?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Se muestra cuando no hay filas. Lo arma quien llama: sólo la pantalla sabe
   *  si el vacío es "todavía no hay nada" o "el filtro no matcheó". */
  empty?: ReactNode;
  /**
   * Primera carga, sin datos previos. Dibuja el esqueleto de la tabla.
   */
  isLoading?: boolean;
  /**
   * Recarga en segundo plano CON datos ya en pantalla. No vuelve al esqueleto:
   * reemplazar una tabla que se está leyendo por barras grises es peor que
   * mostrar el dato viejo un segundo más. Sólo la atenúa y la marca `aria-busy`
   * para que un lector de pantalla sepa que está por cambiar.
   */
  isFetching?: boolean;
  /** Falla de la query. Gana sobre todo lo demás. */
  error?: unknown;
  onRetry?: () => void;
  /** Filas del esqueleto. Por defecto 5, que es lo que entra sin scrollear. */
  skeletonRows?: number;
  className?: string;
}

/**
 * Tabla que no desborda en celular.
 *
 * Una tabla de 5 columnas en 390px no entra: o se aplasta hasta ser ilegible, o
 * empuja el body a scrollear de costado. El scroll horizontal tampoco alcanza —
 * esconde columnas detrás de un gesto que nadie descubre. Acá el mismo dato se
 * presenta de dos formas: tabla real de md en adelante, y una lista de tarjetas
 * abajo de eso, armada desde la MISMA definición de columnas para que las dos
 * vistas no se desincronicen.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  skeletonRows = 5,
  className,
}: ResponsiveTableProps<T>) {
  // PRECEDENCIA: error > cargando > vacío > filas.
  //
  // El error va primero porque con la query caída no sabemos si la tabla está
  // vacía: mostrar "todavía no cargaste nada" cuando en realidad falló la API
  // invita a cargar de nuevo algo que ya existe.
  if (error) {
    return <TableError error={error} onRetry={onRetry} className={className} />;
  }

  if (isLoading) {
    return (
      <TableSkeleton columns={columns} rows={skeletonRows} className={className} />
    );
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const role = (c: ResponsiveColumn<T>): ResponsiveColumnRole => c.mobile ?? 'field';
  const primary = columns.find((c) => role(c) === 'primary');
  const secondary = columns.filter((c) => role(c) === 'secondary');
  const fields = columns.filter((c) => role(c) === 'field');
  const actions = columns.filter((c) => role(c) === 'actions');

  return (
    <div
      className={cn(
        // La recarga en segundo plano se nota, pero no bloquea: la tabla se
        // sigue pudiendo leer y clickear mientras llega el dato nuevo.
        isFetching && 'opacity-60 transition-opacity',
        className,
      )}
      aria-busy={isFetching || undefined}
    >
      {/* Desktop: tabla real, dentro de un contenedor que scrollea por su cuenta
          si el contenido es más ancho que la caja. */}
      <div className="hidden md:block">
        <div
          className="overflow-x-auto rounded-lg border border-border bg-card shadow-surface"
          tabIndex={0}
          role="region"
        >
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.id} className={c.headerClassName}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((c) => (
                    <TableCell key={c.id} className={c.cellClassName}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Celular: una tarjeta por fila. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            className="rounded-lg border border-border bg-card p-4 shadow-surface"
          >
            <div
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('flex flex-col gap-3', onRowClick && 'cursor-pointer')}
            >
              {(primary || secondary.length > 0) && (
                <div className="flex items-start justify-between gap-3">
                  {primary && (
                    <div className="min-w-0 flex-1 font-medium">{primary.cell(row)}</div>
                  )}
                  {secondary.length > 0 && (
                    <div className="flex shrink-0 items-center gap-2">
                      {secondary.map((c) => (
                        <div key={c.id}>{c.cell(row)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {fields.length > 0 && (
                <dl className="flex flex-col gap-1.5">
                  {fields.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-muted-foreground">{c.header}</dt>
                      <dd className="min-w-0 text-right">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {actions.length > 0 && (
              <div
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {actions.map((c) => (
                  <div key={c.id}>{c.cell(row)}</div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Esqueleto de carga, armado desde las MISMAS columnas que la tabla real.
 *
 * Se dibujan las dos vistas —tabla y tarjetas— con los mismos breakpoints que
 * el contenido: si el esqueleto fuera una sola caja gris, al llegar los datos
 * la página saltaría de alto y el encabezado se movería abajo del dedo.
 *
 * Va con los headers de verdad puestos: son texto estático que ya conocemos, y
 * mostrarlos hace que la carga se lea como "esta tabla se está llenando" y no
 * como "acá no hay nada".
 */
function TableSkeleton<T>({
  columns,
  rows,
  className,
}: {
  columns: ResponsiveColumn<T>[];
  rows: number;
  className?: string;
}) {
  const visibles = columns.filter((c) => (c.mobile ?? 'field') !== 'desktopOnly');

  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-surface">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.id} className={c.headerClassName}>
                    {c.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }, (_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.id} className={c.cellClassName}>
                      <Skeleton className="h-4 w-full rounded-sm" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="rounded-lg border border-border bg-card p-4 shadow-surface">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-2/5 rounded-sm" />
                <Skeleton className="h-4 w-16 rounded-sm" />
              </div>
              {visibles.slice(1).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-24 rounded-sm" />
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** La query falló y no hay nada que mostrar. */
function TableError({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      <EmptyState
        variant="error"
        title={t('common.loadErrorTitle')}
        description={error instanceof Error ? error.message : t('common.loadErrorDescription')}
        action={onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : undefined}
      />
    </div>
  );
}
