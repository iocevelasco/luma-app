import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PlatformFollowUpPage } from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ListSection, RowCardList } from '@/components/common/row-card-list';
import { AccountFollowUpRow } from '@/components/platform/account-follow-up-row';

/**
 * Las cuentas con membresía, agrupadas en las que necesitan atención y las que
 * están al día. La API ya las manda ordenadas (riesgo primero); acá solo se
 * cortan los dos grupos de la página.
 */
export function AccountsFollowUp({
  page,
  filtered,
}: {
  page: PlatformFollowUpPage;
  /** Hay búsqueda o filtro: el vacío sugiere probar otro. */
  filtered: boolean;
}) {
  const { t } = useTranslation();

  if (page.rows.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={t('platform.followUp.empty')}
        description={filtered ? t('platform.followUp.emptyFiltered') : undefined}
      />
    );
  }

  const attention = page.rows.filter((row) => row.risk);
  const upToDate = page.rows.filter((row) => !row.risk);

  return (
    <div className="flex flex-col gap-6">
      {attention.length > 0 && (
        <ListSection label={t('platform.followUp.groups.risk')} meta={attention.length}>
          <RowCardList>
            {attention.map((row) => (
              <AccountFollowUpRow key={row.id} row={row} />
            ))}
          </RowCardList>
        </ListSection>
      )}
      {upToDate.length > 0 && (
        <ListSection label={t('platform.followUp.groups.ok')} meta={upToDate.length}>
          <RowCardList>
            {upToDate.map((row) => (
              <AccountFollowUpRow key={row.id} row={row} />
            ))}
          </RowCardList>
        </ListSection>
      )}
    </div>
  );
}
