import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Briefcase,
  Calculator,
  CalendarRange,
  Flag,
  HardHat,
  Inbox,
  ListChecks,
  Mail,
  Package,
  Receipt,
  SearchX,
  Trash2,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Ilustración de cada vacío (`public/empty-states/<nombre>.webp`, guía de estilo y prompts en
 * `docs/design/ilustraciones-estados-vacios.md`). Se elige por el ícono que ya pasa cada
 * pantalla: ninguna tuvo que cambiar. Un ícono sin ilustración sigue con el círculo de siempre.
 */
const ILLUSTRATION_BY_ICON = new Map<LucideIcon, string>([
  [HardHat, 'obras'],
  [Calculator, 'presupuesto'],
  [Receipt, 'gastos'],
  [Wallet, 'cobros'],
  [Package, 'materiales'],
  [Warehouse, 'deposito'],
  [Wrench, 'proveedores'],
  [Flag, 'hitos'],
  [CalendarRange, 'actividades'],
  [Trash2, 'papelera'],
  [Briefcase, 'equipo'],
  [Users, 'equipo'],
  [SearchX, 'sin-resultados'],
  [AlertTriangle, 'error'],
  [Inbox, 'vacio'],
  [Mail, 'vacio'],
  [ListChecks, 'vacio'],
]);

interface EmptyStateProps {
  /** El ícono de lo que falta. Siempre un Lucide; si tiene ilustración, es la que se muestra. */
  icon?: LucideIcon;
  title: string;
  /** Qué puede hacer la persona. Un vacío sin salida es una pared. */
  description?: string;
  /**
   * La salida del vacío: el botón que crea lo que falta, debajo del texto. En el
   * vacío de una pantalla lo pone `PageLayout` con las altas de la pantalla
   * (`action` y `dockActions`); en uno dentro de un bloque (una tabla sin filas,
   * un error con "reintentar") lo pone quien lo dibuja.
   */
  action?: ReactNode;
  className?: string;
}

/**
 * Estado vacío, uno para toda la app: ilustración (o ícono en un círculo), título y
 * una línea que dice qué hacer.
 *
 * Eran ilustraciones distintas según la pantalla (planilla, billetera, campana)
 * más párrafos sueltos sin nada. Un solo tratamiento le dice a la persona que
 * está ante lo mismo —"todavía no hay nada acá"— sea cual sea la sección.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const illustration = ILLUSTRATION_BY_ICON.get(Icon);
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center',
        className,
      )}
      data-testid="empty-state"
    >
      {illustration ? (
        <>
          {/* El fondo de la ilustración es blanco: `multiply` lo funde con el lienzo gris. En
              superficie oscura no funde, y ahí queda el círculo con el ícono. */}
          <img
            src={`${import.meta.env.BASE_URL}empty-states/${illustration}.webp`}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="size-40 mix-blend-multiply select-none dark:hidden"
          />
          <div className="hidden size-16 items-center justify-center rounded-full bg-secondary text-muted-foreground dark:flex">
            <Icon className="size-7" aria-hidden="true" />
          </div>
        </>
      ) : (
        <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>

      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
