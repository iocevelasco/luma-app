import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { PlanVersionSummary } from '@luma/shared';
import { ListSection, RowCard, RowCardBody, RowCardEnd, RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { PlanConfigForm } from '@/components/platform/plan-config-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePlanCatalog } from '@/hooks/platform/use-platform-billing-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { formatMoney } from '@/lib/format-money';

function VersionRow({ entry, current }: { entry: PlanVersionSummary; current: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);
  const { config } = entry;

  return (
    <RowCard>
      <RowCardBody
        title={t('platform.plans.version', { version: entry.version })}
        meta={[
          entry.createdAt ? format(new Date(entry.createdAt), 'PP', { locale }) : t('platform.plans.factory'),
          t('platform.plans.summary', {
            base: usd(config.basePriceUsd),
            included: config.includedProjects,
            unlimited:
              config.unlimitedPriceUsd === null ? t('platform.plans.notOffered') : usd(config.unlimitedPriceUsd),
          }),
          entry.note,
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      {current && (
        <RowCardEnd>
          <Badge>{t('platform.plans.current')}</Badge>
        </RowCardEnd>
      )}
    </RowCard>
  );
}

/**
 * La lista de precios de Luma. Sólo con `role: 'admin'`: la ruta va detrás de
 * `AdminLayout` y la API lo vuelve a exigir.
 */
export function PlatformPlansPage() {
  const { t } = useTranslation();
  const { data: catalog, isLoading, isError } = usePlanCatalog();

  return (
    <PageLayout width="default" isLoading={isLoading} isError={isError}>
      {catalog && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <PlanConfigForm catalog={catalog} />
            </CardContent>
          </Card>
          <ListSection label={t('platform.plans.historyTitle')}>
            <RowCardList>
              {catalog.history.map((entry) => (
                <VersionRow
                  key={entry.version}
                  entry={entry}
                  current={entry.version === catalog.current.version}
                />
              ))}
            </RowCardList>
          </ListSection>
        </div>
      )}
    </PageLayout>
  );
}

export default PlatformPlansPage;
