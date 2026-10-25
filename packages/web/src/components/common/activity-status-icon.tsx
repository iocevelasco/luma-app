import type { ActivityStatus } from '@luma/shared';
import { ArrowRight, Check, Clock, Plus, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * El ícono de cada estado de una actividad. Uno solo para toda la pantalla: el
 * badge, las columnas del Tablero, el selector del detalle y los filtros dicen
 * "en curso" con el mismo dibujo, y quien lo aprende en uno lo reconoce en los
 * otros.
 */
export const ACTIVITY_STATUS_ICON: Record<ActivityStatus, LucideIcon> = {
  pendiente: Plus,
  en_curso: ArrowRight,
  en_revision: Clock,
  completada: Check,
  cancelada: X,
};

/** El tono de cada estado, con los tokens del panel. */
const TONE: Record<ActivityStatus, string> = {
  pendiente: 'text-muted-foreground',
  en_curso: 'text-info',
  en_revision: 'text-warning',
  completada: 'text-success',
  cancelada: 'text-muted-foreground',
};

export function ActivityStatusIcon({
  status,
  className,
}: {
  status: ActivityStatus;
  className?: string;
}) {
  const Icon = ACTIVITY_STATUS_ICON[status];
  return <Icon aria-hidden className={cn('size-4 shrink-0', TONE[status], className)} />;
}
