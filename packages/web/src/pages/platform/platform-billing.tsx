import { useState } from 'react';
import { AlertTriangle, BadgeCheck, CircleX, Clock, Inbox, Landmark, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubscriptionPaymentStatus } from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { ExchangeRatesPanel } from '@/components/platform/exchange-rates-panel';
import { PaymentReviewCard } from '@/components/platform/payment-review-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePaymentSetup, usePlatformPayments } from '@/hooks/platform/use-platform-billing-queries';

const STATUSES: SubscriptionPaymentStatus[] = ['pendiente', 'aprobado', 'rechazado'];

const STATUS_ICON: Record<SubscriptionPaymentStatus, LucideIcon> = {
  pendiente: Clock,
  aprobado: BadgeCheck,
  rechazado: CircleX,
};

function PaymentList({ status }: { status: SubscriptionPaymentStatus }) {
  const { t } = useTranslation();
  const { data: payments = [], isLoading } = usePlatformPayments(status);

  if (isLoading) return <LoadingIndicator />;
  if (payments.length === 0) {
    return <EmptyState icon={Inbox} title={t('platform.payments.empty')} />;
  }
  return (
    <RowCardList>
      {payments.map((payment) => (
        <li key={payment.id}>
          <PaymentReviewCard payment={payment} />
        </li>
      ))}
    </RowCardList>
  );
}

/** Lo que impide cobrar o recibir comprobantes en este entorno. Sin problemas, no ocupa lugar. */
function PaymentSetupNotice() {
  const { t } = useTranslation();
  const { data: setup } = usePaymentSetup();
  if (!setup) return null;

  const notices = [
    ...(!setup.card && !setup.pagoMovil && !setup.transferencia && !setup.binance ? [t('platform.payments.noMethods')] : []),
    ...(!setup.receipts ? [t('platform.payments.noReceiptStorage')] : []),
  ];
  if (notices.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {notices.map((notice) => (
        <p
          key={notice}
          className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {notice}
        </p>
      ))}
    </div>
  );
}

/**
 * Lo que opera el admin de la plataforma: los pagos de la suscripción en
 * bolívares (aprobar o rechazar) y la tasa BCV. Sólo con `role: 'admin'`: la
 * ruta va detrás de `AdminLayout` y la API lo vuelve a exigir.
 */
export function PlatformBillingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string>('pendiente');

  return (
    <PageLayout width="default">
      <PaymentSetupNotice />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUSES.map((status) => (
            <TabsTrigger key={status} value={status} icon={STATUS_ICON[status]}>
              {t(`platform.tabs.${status}`)}
            </TabsTrigger>
          ))}
          <TabsTrigger value="rates" icon={Landmark}>
            {t('platform.tabs.rates')}
          </TabsTrigger>
        </TabsList>
        {STATUSES.map((status) => (
          <TabsContent key={status} value={status} className="pt-4">
            <PaymentList status={status} />
          </TabsContent>
        ))}
        <TabsContent value="rates" className="pt-4">
          <ExchangeRatesPanel />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

export default PlatformBillingPage;
