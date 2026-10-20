import type { SubscriptionPaymentStatus } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

/** Mismo criterio que `ActivityStatusBadge`: tokens de estado, sin tocar `ui/`. */
const CLASSES: Record<SubscriptionPaymentStatus, string> = {
  pendiente: 'bg-warning text-warning-foreground',
  aprobado: 'bg-success text-success-foreground',
  rechazado: 'bg-destructive text-destructive-foreground',
};

export function PaymentStatusBadge({ status }: { status: SubscriptionPaymentStatus }) {
  const { t } = useTranslation();
  return <Badge className={CLASSES[status]}>{t(`subscription.paymentStatus.${status}`)}</Badge>;
}
