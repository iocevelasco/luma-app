import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/common/empty-state';
import { ListSection, RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { CampaignForm } from '@/components/platform/campaign-form';
import { CampaignRowCard } from '@/components/platform/campaign-row-card';
import { useCampaignAudience, useCampaigns } from '@/hooks/platform/use-platform-campaigns-queries';

/**
 * Comunicados por correo a las cuentas de Luma: se escribe uno (título,
 * contenido, imagen), se prueba contra la casilla del propio admin y recién
 * entonces se envía. Sólo `role: 'admin'`; la API lo vuelve a exigir.
 */
export function PlatformCampaignsPage() {
  const { t } = useTranslation();
  const campaigns = useCampaigns();
  const audience = useCampaignAudience();

  return (
    <PageLayout width="default" isLoading={campaigns.isLoading} isError={campaigns.isError}>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {t('platform.campaigns.audience', { count: audience.data?.recipients ?? 0 })}
        </p>
        <CampaignForm />
        <ListSection label={t('platform.campaigns.history')}>
          {campaigns.data && campaigns.data.length > 0 ? (
            <RowCardList>
              {campaigns.data.map((campaign) => (
                <CampaignRowCard key={campaign.id} campaign={campaign} />
              ))}
            </RowCardList>
          ) : (
            <EmptyState icon={Mail} title={t('platform.campaigns.empty')} />
          )}
        </ListSection>
      </div>
    </PageLayout>
  );
}

export default PlatformCampaignsPage;
