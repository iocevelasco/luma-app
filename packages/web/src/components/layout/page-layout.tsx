import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { useContentArea } from '@/components/layout/content-area-context';
import { RouteError } from '@/components/routes/route-error';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
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
   * Va SIEMPRE abajo al centro, flotando, con el mismo botón, esté la
   * pantalla vacía o llena. Una por pantalla: con dos, ninguna es "la"
   * principal.
   */
  action?: ReactNode;
  /**
   * Las demás altas de la pantalla ("Agregar cuota", "Agregar desde la
   * Empresa"). Flotan junto a la principal, en el mismo grupo y a su izquierda:
   * quien viene a agregar algo encuentra todas las opciones en un solo lugar.
   * Son botones `outline`; la principal es la única llena.
   */
  dockActions?: ReactNode;
  /**
   * Controles de la vista que no agregan nada: exportar, zoom, "Ir a hoy".
   * Van en la barra de arriba, a la derecha.
   */
  secondaryActions?: ReactNode;
  /** Filtros y controles de la vista. Arriba a la izquierda, en la misma fila que las acciones de segundo orden. */
  toolbar?: ReactNode;
  /** Muestra la carga unificada en lugar del contenido. */
  isLoading?: boolean;
  /** Muestra el error de ruta en lugar del contenido. */
  isError?: boolean;
  /**
   * Si viene, la pantalla no tiene nada para mostrar: se dibuja este vacío en
   * lugar de `children`. La barra de arriba (filtros y acción) se mantiene:
   * la salida de un vacío es la misma acción de siempre, en su lugar.
   *
   * Por eso un diálogo que abre una acción de la barra **no va en
   * `children`**: con la pantalla vacía no se monta, y el botón queda sin
   * hacer nada justo cuando es la única salida. Va al lado de `PageLayout`,
   * en un fragmento.
   */
  empty?: PageLayoutEmpty;
  width?: PageLayoutWidth;
  /**
   * El contenido ocupa el alto que queda de la ventana y scrollea por dentro.
   * Para lo que no es una página que se lee de corrido: un diagrama, un tablero.
   */
  fill?: boolean;
  /**
   * Deja lugar abajo para algo que flota sobre el contenido encima del grupo de
   * acciones: el aviso de filtros de Actividades. Va aparte de `action` porque el
   * aviso depende del estado, no de la pantalla.
   */
  reserveBottom?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * El esqueleto de toda pantalla del panel: barra superior (filtros a la
 * izquierda, controles de la vista a la derecha), contenido, las altas
 * (la principal y las demás) juntas y flotando abajo al centro, y los tres
 * estados que todas comparten —cargando, error, vacío—.
 *
 * Existe porque cada pantalla armaba el suyo: el botón principal flotaba en
 * un lado en unas, estaba arriba en otras y en otras aparecía en el medio
 * del vacío; el padding variaba de una a otra; y el vacío y la carga eran
 * distintos en cada una. Todo eso es una sola decisión y vive acá.
 *
 * El aire alrededor lo pone el `<main>` de `DashboardLayout`: este componente
 * no agrega padding propio, para que ninguna pantalla se desvíe.
 */
export function PageLayout({
  action,
  dockActions,
  secondaryActions,
  toolbar,
  isLoading = false,
  isError = false,
  empty,
  width = 'default',
  fill = false,
  reserveBottom = false,
  className,
  children,
}: PageLayoutProps) {
  const insideProject = Boolean(useCurrentProjectId());
  const contentArea = useContentArea();

  if (isError) return <RouteError />;
  if (isLoading) return <LoadingIndicator />;

  const hasBar = Boolean(toolbar || secondaryActions);

  // Las altas de la pantalla, juntas y flotando abajo al centro. En mobile, fuera de una
  // obra sube lo que mide la barra inferior de navegación; adentro de una obra esa barra no
  // está (la navegación es la tira de arriba). `safe-area-inset-bottom` evita que el home
  // indicator de iOS lo tape.
  const dock =
    action || dockActions ? (
      <div
        data-testid="action-dock"
        className={cn(
          contentArea ? 'absolute' : 'fixed',
          'left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 md:bottom-8 [&_a]:shadow-lg [&_button]:shadow-lg',
          insideProject
            ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {dockActions}
        {action && <div data-testid="primary-action">{action}</div>}
      </div>
    ) : null;

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
            className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2"
            data-testid="page-actions"
          >
            {secondaryActions}
          </div>
        </div>
      )}

      {/* Sólo el contenido se angosta; la barra de arriba no. */}
      <div
        data-testid="page-content"
        className={cn(
          'mx-auto flex w-full min-w-0 flex-col gap-6',
          WIDTH_CLASS[width],
          fill && 'min-h-0 flex-1',
          // Lugar para que el botón flotante no tape lo último de la lista.
          // En `fill` el grupo (centrado) taparía el medio del diagrama o la parte vacía de las
          // columnas del Tablero donde se suelta una tarea: el contenido le deja su lugar.
          (action || dockActions) && (fill ? 'pb-[4.5rem]' : 'pb-16'),
          // El aviso flota encima del grupo de acciones (2rem + ~2.75rem + aire) y tapaba la
          // última fila.
          reserveBottom && 'pb-[calc(8rem+env(safe-area-inset-bottom))]',
        )}
      >
        {empty ? (
          <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
        ) : (
          children
        )}
      </div>

      {dock &&
        // En el área de contenido (no en la ventana): el centro es el de lo que se ve, con
        // el riel a un lado. Sin ella (la plataforma, que no tiene riel) flota sobre la ventana.
        (contentArea ? createPortal(dock, contentArea) : dock)}
    </div>
  );
}

export default PageLayout;
