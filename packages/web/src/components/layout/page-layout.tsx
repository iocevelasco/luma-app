import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { RouteError } from '@/components/routes/route-error';
import { cn } from '@/lib/utils';

/**
 * Ancho del contenido. `default` es el de toda pantalla de lectura o lista;
 * `full` es para las que necesitan el ancho entero (el Cronograma, el
 * Tablero); `narrow` es para formularios y textos.
 */
export type PageLayoutWidth = 'narrow' | 'default' | 'full';

const WIDTH_CLASS: Record<PageLayoutWidth, string> = {
  narrow: 'max-w-2xl',
  default: 'max-w-4xl',
  full: 'max-w-none',
};

export interface PageLayoutEmpty {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

interface PageLayoutProps {
  /**
   * La acción principal de la pantalla: "Nueva tarea", "Agregar material".
   * Va SIEMPRE arriba a la derecha, con el mismo botón, esté la pantalla
   * vacía o llena. Una por pantalla: con dos, ninguna es "la" principal.
   */
  action?: ReactNode;
  /** Acciones de segundo orden. Van pegadas a la principal, a su izquierda. */
  secondaryActions?: ReactNode;
  /** Filtros y controles de la vista. Arriba a la izquierda, en la misma fila que la acción. */
  toolbar?: ReactNode;
  /** Muestra la carga unificada en lugar del contenido. */
  isLoading?: boolean;
  /** Muestra el error de ruta en lugar del contenido. */
  isError?: boolean;
  /**
   * Si viene, la pantalla no tiene nada para mostrar: se dibuja este vacío en
   * lugar de `children`. La barra de arriba (filtros y acción) se mantiene:
   * la salida de un vacío es la misma acción de siempre, en su lugar.
   */
  empty?: PageLayoutEmpty;
  width?: PageLayoutWidth;
  /**
   * El contenido ocupa el alto que queda de la ventana y scrollea por dentro.
   * Para lo que no es una página que se lee de corrido: un diagrama, un tablero.
   */
  fill?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * El esqueleto de toda pantalla del panel: barra superior (filtros a la
 * izquierda, acción principal a la derecha), contenido, y los tres estados que
 * todas comparten —cargando, error, vacío—.
 *
 * Existe porque cada pantalla armaba el suyo: el botón principal flotaba abajo
 * a la derecha en unas, estaba arriba en otras y en otras aparecía en el medio
 * del vacío; el padding variaba de una a otra; y el vacío y la carga eran
 * distintos en cada una. Todo eso es una sola decisión y vive acá.
 *
 * El aire alrededor lo pone el `<main>` de `DashboardLayout`: este componente
 * no agrega padding propio, para que ninguna pantalla se desvíe.
 */
export function PageLayout({
  action,
  secondaryActions,
  toolbar,
  isLoading = false,
  isError = false,
  empty,
  width = 'default',
  fill = false,
  className,
  children,
}: PageLayoutProps) {
  if (isError) return <RouteError />;
  if (isLoading) return <LoadingIndicator />;

  const hasBar = Boolean(toolbar || action || secondaryActions);

  return (
    <div
      className={cn(
        // La barra de arriba va siempre de borde a borde del área de trabajo:
        // así la acción principal queda en el mismo lugar en todas las
        // pantallas, sea cual sea el ancho de su contenido.
        'flex w-full flex-col gap-6',
        // 5.5rem = header (3.5rem) + el padding vertical de `<main>` (2 × 1rem).
        fill && 'h-[calc(100dvh-5.5rem)] gap-4',
        className,
      )}
    >
      {hasBar && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbar}</div>
          <div
            className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2"
            data-testid="page-actions"
          >
            {secondaryActions}
            {action}
          </div>
        </div>
      )}

      {/* Sólo el contenido se angosta; la barra de arriba no. */}
      <div
        className={cn(
          'mx-auto flex w-full min-w-0 flex-col gap-6',
          WIDTH_CLASS[width],
          fill && 'min-h-0 flex-1',
        )}
      >
        {empty ? (
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default PageLayout;
