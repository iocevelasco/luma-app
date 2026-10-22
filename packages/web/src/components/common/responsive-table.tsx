import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { EmptyState } from '@/components/common/empty-state';
import { ROW_CARD, RowCard, RowCardList } from '@/components/common/row-card-list';
import { AlertTriangle } from 'lucide-react';
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
  /** Ancho de la columna en escritorio, como pista de `grid-template-columns`
   *  (`'8rem'`, `'minmax(0, 1fr)'`). Por defecto, la principal se lleva lo que
   *  sobra y las demás miden su contenido. */
  width?: string;
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
  className?: string;
}

/**
 * Tabla que no desborda en celular, con una fila-tarjeta por registro.
 *
 * Una tabla de 5 columnas en 390px no entra: o se aplasta hasta ser ilegible, o
 * empuja el body a scrollear de costado. El scroll horizontal tampoco alcanza —
 * esconde columnas detrás de un gesto que nadie descubre. Acá el mismo dato se
 * presenta de dos formas: de md en adelante, filas-tarjeta con las columnas
 * alineadas como en una tabla; abajo de eso, la tarjeta con los datos apilados, armada desde la MISMA definición de columnas para que las dos
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
    return <LoadingIndicator className={cn('min-h-40', className)} />;
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const role = (c: ResponsiveColumn<T>): ResponsiveColumnRole => c.mobile ?? 'field';
  const primary = columns.find((c) => role(c) === 'primary');
  const secondary = columns.filter((c) => role(c) === 'secondary');
  const fields = columns.filter((c) => role(c) === 'field');
  const actions = columns.filter((c) => role(c) === 'actions');

  // La columna principal se lleva el ancho que sobra; las demás miden lo que
  // su contenido. Es la plantilla que comparten el encabezado y cada fila.
  const template = columns
    .map((c) => c.width ?? (c === primary ? 'minmax(8rem, 1fr)' : 'auto'))
    .join(' ');

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
      {/*
        Desktop: una tarjeta por fila, con las columnas alineadas entre todas.
        Cada fila es un `subgrid` de la grilla de afuera: así una celda ancha
        en la fila 7 corre la columna en todas, como en una tabla, sin que la
        fila deje de ser su propia caja (con su radio, su sombra y su hover).
        Los roles de ARIA devuelven la semántica de tabla que los <div> no tienen.
      */}
      <div
        role="table"
        className="hidden gap-x-4 gap-y-3 md:grid"
        style={{ gridTemplateColumns: template }}
      >
        <div role="row" className="col-span-full grid grid-cols-subgrid px-5">
          {columns.map((c) => (
            <div
              key={c.id}
              role="columnheader"
              className={cn('min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground', c.headerClassName)}
            >
              {c.header}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            role="row"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(ROW_CARD, 'col-span-full grid grid-cols-subgrid gap-x-4 px-5', onRowClick && 'cursor-pointer')}
          >
            {columns.map((c) => (
              <div key={c.id} role="cell" className={cn('min-w-0', c.cellClassName)}>
                {c.cell(row)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Celular: la misma fila-tarjeta, con los datos apilados. */}
      <RowCardList className="md:hidden">
        {rows.map((row) => (
          <RowCard key={getRowKey(row)} className="flex-col items-stretch">
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
                className="flex flex-wrap items-center gap-2 border-t border-border pt-3 [&_:is(button,a)]:min-h-11 [&_:is(button,a)]:min-w-11"
                onClick={(e) => e.stopPropagation()}
              >
                {actions.map((c) => (
                  <div key={c.id}>{c.cell(row)}</div>
                ))}
              </div>
            )}
          </RowCard>
        ))}
      </RowCardList>
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
        icon={AlertTriangle}
        title={t('common.loadErrorTitle')}
        description={error instanceof Error ? error.message : t('common.loadErrorDescription')}
        action={onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : undefined}
      />
    </div>
  );
}
