import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_PERIODS, type ActivityPeriod } from '@luma/shared';
import { ActivityTable } from '@/components/platform/activity-table';
import { PageLayout } from '@/components/layout/page-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformActivity } from '@/hooks/platform/use-platform-activity-queries';

/**
 * Cuánto hace la gente, por rol de obra. Son conteos agregados que la API ya
 * filtró: lo que no alcanza el umbral de personas llega sin cifras y acá sólo
 * se rotula. Sólo lectura.
 */
export function PlatformActivityPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ActivityPeriod>('30d');
  const activity = usePlatformActivity();

  const toolbar = (
    <Tabs value={period} onValueChange={(value) => setPeriod(value as ActivityPeriod)}>
      <TabsList aria-label={t('platform.activity.periodLabel')}>
        {ACTIVITY_PERIODS.map((value) => (
          <TabsTrigger key={value} value={value}>
            {t(`platform.activity.periods.${value}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  return (
    <PageLayout
      width="default"
      toolbar={toolbar}
      isLoading={activity.isLoading}
      isError={activity.isError}
    >
      {activity.data && <ActivityTable report={activity.data} period={period} />}
    </PageLayout>
  );
}

export default PlatformActivityPage;
