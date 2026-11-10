import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { useContentArea } from '@/components/layout/content-area-context';
import { useViewTabsSlot } from '@/components/layout/view-tabs-slot-context';
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
   * Con contenido, va abajo al centro, flotando, siempre con el mismo botón.
   * Con la pantalla vacía (`empty`), va **dentro del vacío**, debajo del texto:
   * es la única salida y tiene que estar donde se mira. Una por pantalla: con
   * dos, ninguna es "la" principal.
   */
  action?: ReactNode;
  /**
   * Las demás altas de la pantalla ("Agregar cuota", "Agregar desde la
   * Empresa"). Van junto a la principal, en el mismo grupo y a su izquierda
   * (flotando abajo con contenido; dentro del vacío si no lo hay): quien viene
   * a agregar algo encuentra todas las opciones en un solo lugar.
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
  /**
   * La barra de arriba no se parte en dos filas: `toolbar` ocupa el ancho que dejan las
   * acciones de la derecha y sus controles se angostan. Para barras de filtros que, con el
   * ancho para ello, tienen que quedar en una sola línea.
   */
  toolbarSingleRow?: boolean;
  /**
   * Las pestañas de vista de la pantalla (En patio / Kardex). Si la obra muestra la fila de
   * pestañas de sección (Compras / Proveedores / Inventario), van **en esa misma fila**, a la
   * misma altura; si no, abren la barra de arriba. Los filtros siguen en `toolbar`.
   */
  viewTabs?: ReactNode;
  /** Muestra la carga unificada en lugar del contenido. */
  isLoading?: boolean;
  /** Muestra el error de ruta en lugar del contenido. */
  isError?: boolean;
  /**
   * Si viene, la pantalla no tiene nada para mostrar: se dibuja este vacío en
   * lugar de `children`, con las altas (`action` y `dockActions`) debajo del
   * texto. La barra de arriba (filtros) se mantiene.
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
  toolbarSingleRow = false,
  viewTabs,
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
  const { slot: viewTabsSlot } = useViewTabsSlot();

  if (isError) return <RouteError />;
  if (isLoading) return <LoadingIndicator />;

  const tabsInSlot = Boolean(viewTabs && viewTabsSlot);
  const hasBar = Boolean(toolbar || secondaryActions || (viewTabs && !tabsInSlot));

  // Las altas de la pantalla, juntas y flotando abajo al centro. En mobile, fuera de una
  // obra sube lo que mide la barra inferior de navegación; adentro de una obra esa barra no
  // está (la navegación es la tira de arriba). `safe-area-inset-bottom` evita que el home
  // indicator de iOS lo tape.
  const actions =
    action || dockActions ? (
      <>
        {dockActions}
        {action && <div data-testid="primary-action">{action}</div>}
      </>
    ) : null;

  // Con la pantalla vacía las altas van dentro del vacío, no flotando.
  const dock =
    actions && !empty ? (
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
        {actions}
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
      {tabsInSlot && viewTabsSlot && createPortal(viewTabs, viewTabsSlot)}
      {hasBar && (
        <div className={cn('flex items-center justify-between gap-3', !toolbarSingleRow && 'flex-wrap')}>
          <div
            className={cn(
              'flex min-w-0 items-center gap-2',
              toolbarSingleRow ? 'flex-1 flex-nowrap' : 'flex-wrap',
            )}
          >
            {!tabsInSlot && viewTabs}
            {toolbar}
          </div>
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
          dock && (fill ? 'pb-[4.5rem]' : 'pb-16'),
          // El aviso flota encima del grupo de acciones (2rem + ~2.75rem + aire) y tapaba la
          // última fila.
          reserveBottom && 'pb-[calc(8rem+env(safe-area-inset-bottom))]',
        )}
      >
        {empty ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            action={
              actions && (
                <div
                  data-testid="action-dock"
                  className="flex flex-wrap items-center justify-center gap-2"
                >
                  {actions}
                </div>
              )
            }
          />
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
