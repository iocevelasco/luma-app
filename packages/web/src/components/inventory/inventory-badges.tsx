import type { StockLevel, StockMovementKind } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

/**
 * El tono de cada estado vive acá y no en la página: el mismo tag en el stock y
 * en el kardex. Rojo sólo lo que está agotado o se perdió.
 */
const LEVEL_VARIANT: Record<StockLevel, BadgeVariant> = {
  ok: 'success',
  low: 'warning',
  out: 'danger',
};

const KIND_VARIANT: Record<StockMovementKind, BadgeVariant> = {
  compra: 'info',
  devolucion: 'success',
  consumo: 'neutral',
  merma: 'danger',
  desincorporacion: 'warning',
  importacion: 'success',
  deposito_ingreso: 'info',
  deposito_egreso: 'neutral',
};

export function StockLevelBadge({ level }: { level: StockLevel }) {
  const { t } = useTranslation();
  return <Badge variant={LEVEL_VARIANT[level]}>{t(`inventory.level.${level}`)}</Badge>;
}

export function MovementKindBadge({ kind }: { kind: StockMovementKind }) {
  const { t } = useTranslation();
  return <Badge variant={KIND_VARIANT[kind]}>{t(`inventory.kind.${kind}`)}</Badge>;
}
