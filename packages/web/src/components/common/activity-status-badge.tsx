import type { ActivityStatus } from '@luma/shared';
import { differenceInCalendarDays } from 'date-fns';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_STATUS_ICON } from '@/components/common/activity-status-icon';
import { fromDayKey, toDayKey } from '@/lib/day-key';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
const STATUS_VARIANT: Record<ActivityStatus, BadgeVariant> = {
  pendiente: 'neutral',
  en_curso: 'info',
  en_revision: 'warning',
  completada: 'success',
  cancelada: 'neutral',
};

export function ActivityStatusBadge({
  status,
  endDate,
  alignOverdue = false,
  className,
}: {
  status: ActivityStatus;
  /** Sin fecha no se puede saber si está vencida: sólo muestra el estado. */
  endDate?: string;
  /**
   * Reserva el lugar del reloj aunque no esté vencida. Para una columna de
   * estados: el reloj sólo aparece en algunas filas y, sin el hueco, el
   * badge de esas filas queda corrido a la derecha del resto.
   */
  alignOverdue?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const overdue = endDate ? isActivityOverdue(endDate, status) : false;

  return (
    <span className={cn('flex shrink-0 items-center gap-1.5', className)}>
      {overdue && endDate && (
        // Un reloj solo no dice qué es: el tooltip explica que es el atraso y cuánto.
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="inline-flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Clock className="size-3.5 text-destructive" aria-label={t('activity.list.overdue')} />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {t('activity.list.overdueHint', {
              count: differenceInCalendarDays(fromDayKey(toDayKey(new Date())), fromDayKey(endDate)),
            })}
          </TooltipContent>
        </Tooltip>
      )}
      {!overdue && alignOverdue && <span aria-hidden className="size-3.5 shrink-0" />}
      <Badge variant={STATUS_VARIANT[status]} icon={ACTIVITY_STATUS_ICON[status]}>
        {t(`activity.status.${status}`)}
      </Badge>
    </span>
  );
}

export default ActivityStatusBadge;
