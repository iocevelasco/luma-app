import type { MaterialStatus } from '@luma/shared';
import { ArrowRight, Check, Clock, Plus, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

/**
 * El estado de un material, con el mismo tag en Compras y en el detalle de una
 * tarea. Rojo sólo lo que todavía no se pidió: eso es lo que puede frenar una
 * actividad. Lo ya solicitado está en camino, y pintarlo igual que lo que nadie
 * encargó borra la diferencia entre "hay que hacer algo" y "hay que esperar".
 */
const MATERIAL_STATUS_TAG: Record<MaterialStatus, { variant: BadgeVariant; icon: LucideIcon }> = {
  pendiente: { variant: 'danger', icon: Plus },
  solicitado: { variant: 'warning', icon: Clock },
  comprado: { variant: 'info', icon: ArrowRight },
  en_obra: { variant: 'success', icon: Check },
};

export function MaterialStatusBadge({ status }: { status: MaterialStatus }) {
  const { t } = useTranslation();
  const { variant, icon } = MATERIAL_STATUS_TAG[status];

  return (
    <Badge variant={variant} icon={icon}>
      {t(`material.status.${status}`)}
    </Badge>
  );
}
