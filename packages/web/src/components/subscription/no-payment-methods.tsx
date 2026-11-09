import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** La API no ofrece ningún medio de pago: se dice qué pasa en lugar de dejar la tarjeta sin botones. */
export function NoPaymentMethods() {
  const { t } = useTranslation();

  return (
    <p className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <AlertTriangle className="size-4 shrink-0" />
      {t('subscription.pay.none')}
    </p>
  );
}
