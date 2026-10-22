import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SubscriptionPaymentStatus } from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { ExchangeRatesPanel } from '@/components/platform/exchange-rates-panel';
import { PaymentReviewCard } from '@/components/platform/payment-review-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformPayments } from '@/hooks/platform/use-platform-billing-queries';

const STATUSES: SubscriptionPaymentStatus[] = ['pendiente', 'aprobado', 'rechazado'];

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
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUSES.map((status) => (
            <TabsTrigger key={status} value={status}>
              {t(`platform.tabs.${status}`)}
            </TabsTrigger>
          ))}
          <TabsTrigger value="rates">{t('platform.tabs.rates')}</TabsTrigger>
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
