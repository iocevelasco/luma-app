import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** El ícono de lo que falta. Siempre un Lucide: es el mismo vacío en toda la app. */
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
 * Estado vacío, uno para toda la app: ícono en un círculo, título y una línea
 * que dice qué hacer.
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
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center',
        className,
      )}
      data-testid="empty-state"
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="size-7" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>

      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
