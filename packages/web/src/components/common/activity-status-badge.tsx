import type { ActivityStatus } from '@luma/shared';
import { ArrowRight, Check, Clock, Plus, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isActivityOverdue } from '@/lib/week';

/**
 * Estado y atraso son dos cosas distintas, y se muestran por separado.
 *
 * Antes el atraso pintaba el badge entero de rojo y tapaba el estado: en una
 * obra en curso casi todo tiene fecha vencida, así que la pantalla era una
 * pared roja donde no se distinguía lo que estaba en marcha de lo que nadie
 * había empezado. Si todo es urgente, nada lo es.
 *
 * Ahora el color dice en qué estado está —verde cerrado, naranja esperando una
 * decisión, azul en marcha, gris sin empezar o cancelada— y el atraso va
 * aparte, como un reloj rojo al lado. Se leen los dos hechos de un vistazo en
 * vez de que uno tape al otro. El rojo queda para el atraso: acá ningún estado
 * es "peligro".
 */
const STATUS_TAG: Record<ActivityStatus, { variant: BadgeVariant; icon: LucideIcon }> = {
  pendiente: { variant: 'neutral', icon: Plus },
  en_curso: { variant: 'info', icon: ArrowRight },
  en_revision: { variant: 'warning', icon: Clock },
  completada: { variant: 'success', icon: Check },
  cancelada: { variant: 'neutral', icon: X },
};

export function ActivityStatusBadge({
  status,
  endDate,
  className,
}: {
  status: ActivityStatus;
  /** Sin fecha no se puede saber si está vencida: sólo muestra el estado. */
  endDate?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const overdue = endDate ? isActivityOverdue(endDate, status) : false;
  const tag = STATUS_TAG[status];

  return (
    <span className={cn('flex shrink-0 items-center gap-1.5', className)}>
      {overdue && (
        <Clock
          className="size-3.5 text-destructive"
          aria-label={t('activity.list.overdue')}
        />
      )}
      <Badge variant={tag.variant} icon={tag.icon}>
        {t(`activity.status.${status}`)}
      </Badge>
    </span>
  );
}

export default ActivityStatusBadge;
