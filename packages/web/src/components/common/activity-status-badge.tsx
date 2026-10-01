import type { ActivityStatus } from '@luma/shared';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
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
 * Ahora el color dice en qué estado está —verde cerrado, ámbar esperando una
 * decisión, neutro en marcha o sin empezar— y el atraso va aparte, como un
 * reloj rojo al lado. Se leen los dos hechos de un vistazo en vez de que uno
 * tape al otro.
 *
 * `Badge` no trae variantes de éxito/advertencia, así que se envuelve con los
 * tokens del tema en vez de editar el componente de `ui/` (ver CLAUDE.md).
 */
const STATUS_CLASSES: Partial<Record<ActivityStatus, string>> = {
  completada: 'bg-success text-success-foreground',
  en_revision: 'bg-warning text-warning-foreground',
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
  const statusClass = STATUS_CLASSES[status];

  return (
    <span className={cn('flex shrink-0 items-center gap-1.5', className)}>
      {overdue && (
        <Clock
          className="size-3.5 text-destructive"
          aria-label={t('activity.list.overdue')}
        />
      )}
      {/* `en_curso`, `pendiente` y `cancelada` van en neutro: están donde
          tienen que estar, no piden nada a nadie. */}
      <Badge variant={statusClass ? 'default' : 'secondary'} className={statusClass}>
        {t(`activity.status.${status}`)}
      </Badge>
    </span>
  );
}

export default ActivityStatusBadge;
