import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ClipboardList, Warehouse } from 'lucide-react';
import { stockDirection, type DepositLine, type DepositMovement, type SavingsLine } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { SearchField } from '@/components/common/search-field';
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardBody,
  RowCardEnd,
  RowCardList,
} from '@/components/common/row-card-list';
import { MovementKindBadge } from '@/components/inventory/inventory-badges';
import { PageLayout } from '@/components/layout/page-layout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isApiError } from '@/lib/api-client';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useMyDeposit } from '@/hooks/inventory/use-inventory-queries';
import { formatMoney } from '@/lib/format-money';

/**
 * El Depósito General de la Empresa: el material sobrante que viaja entre
 * obras. Se mira acá; se manda y se trae desde el Inventario de cada obra, que
 * es donde está el material.
 */
export function DepositPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'historial' ? 'history' : 'stock';
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useMyDeposit();

  const lines = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.lines ?? []).filter(
      (line) => line.stock > 0 && (!term || line.name.toLowerCase().includes(term)),
    );
  }, [data, search]);

  // Sin Empresa propia (un integrante invitado) no hay Depósito que mostrar: se
  // dice, en vez de una pantalla rota.
  if (isError && isApiError(error) && error.code === 'NOT_FOUND') {
    return (
      <PageLayout
        empty={{
          icon: Warehouse,
          title: t('deposit.notOwner.title'),
          description: t('deposit.notOwner.description'),
        }}
      />
    );
  }
  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  const isEmpty = data.movements.length === 0;

  return (
    <PageLayout
      width="default"
      toolbar={
        <div className="flex w-full flex-col gap-3">
          <Tabs
            value={tab}
            onValueChange={(value) =>
              setSearchParams(value === 'history' ? { tab: 'historial' } : {}, { replace: true })
            }
          >
            <TabsList>
              <TabsTrigger value="stock" icon={Warehouse}>
                {t('deposit.tabs.stock')}
              </TabsTrigger>
              <TabsTrigger value="history" icon={ClipboardList}>
                {t('deposit.tabs.history')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {!isEmpty && tab === 'stock' && (
            <SearchField
              wrapperClassName="max-w-sm"
              placeholder={t('inventory.stock.search')}
              aria-label={t('inventory.stock.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          )}
        </div>
      }
      empty={
        isEmpty
          ? {
              icon: Warehouse,
              title: t('deposit.empty.title'),
              description: t('deposit.empty.description'),
            }
          : undefined
      }
    >
      {tab === 'stock' ? (
        <ListSections className="w-full">
          {data.savings.length > 0 && (
            <ListSection label={t('deposit.savings.title')}>
              <RowCardList>
                {data.savings.map((line) => (
                  <SavingsRow key={`${line.projectId}|${line.currency}`} line={line} locale={i18n.language} />
                ))}
              </RowCardList>
            </ListSection>
          )}
          <ListSection label={t('deposit.stock.title')}>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('deposit.stock.empty')}</p>
            ) : (
              <RowCardList>
                {lines.map((line) => (
                  <LineRow key={line.lineKey} line={line} locale={i18n.language} />
                ))}
              </RowCardList>
            )}
          </ListSection>
        </ListSections>
      ) : (
        <RowCardList className="w-full">
          {data.movements.map((movement) => (
            <HistoryRow key={movement.id} movement={movement} locale={i18n.language} />
          ))}
        </RowCardList>
      )}
    </PageLayout>
  );
}

function LineRow({ line, locale }: { line: DepositLine; locale: string }) {
  const { t } = useTranslation();
  const unit = t(`material.unit.${line.unit}`);

  return (
    <RowCard>
      <RowCardBody
        title={<span className="truncate">{line.name}</span>}
        // El costo ya lleva su moneda; sin costo, la moneda es lo que distingue la línea.
        meta={
          line.unitCost > 0
            ? t('deposit.stock.unitCost', { cost: formatMoney(line.unitCost, line.currency, locale) })
            : `${t('deposit.stock.noCost')} · ${line.currency}`
        }
      />
      <RowCardEnd>
        <p className="text-lg tabular-nums">
          {line.stock} <span className="text-xs text-muted-foreground">{unit}</span>
        </p>
      </RowCardEnd>
    </RowCard>
  );
}

function SavingsRow({ line, locale }: { line: SavingsLine; locale: string }) {
  const { t } = useTranslation();

  return (
    <RowCard>
      <RowCardBody
        title={<span className="truncate">{line.projectName ?? t('deposit.savings.deletedProject')}</span>}
        meta={t('deposit.savings.reused', { count: line.items })}
      />
      <RowCardEnd>
        <p className="text-lg tabular-nums">{formatMoney(line.saved, line.currency, locale)}</p>
      </RowCardEnd>
    </RowCard>
  );
}

function HistoryRow({ movement, locale }: { movement: DepositMovement; locale: string }) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const sign = stockDirection(movement.kind) === 'in' ? '+' : '−';
  const unit = t(`material.unit.${movement.unit}`);
  const where = movement.projectName
    ? t(
        movement.kind === 'deposito_ingreso' ? 'deposit.history.from' : 'deposit.history.to',
        { name: movement.projectName },
      )
    : undefined;

  const meta = [
    format(new Date(movement.occurredAt), 'dd MMM yyyy HH:mm', { locale: dateLocale }),
    where,
    movement.unitCost > 0 ? formatMoney(movement.unitCost, movement.currency, locale) : undefined,
  ].filter(Boolean);

  return (
    <RowCard>
      <RowCardBody title={<span className="truncate">{movement.name}</span>} meta={meta.join(' · ')} />
      <RowCardEnd>
        <MovementKindBadge kind={movement.kind} />
        <p className="tabular-nums">
          {sign}
          {movement.quantity} <span className="text-xs text-muted-foreground">{unit}</span>
        </p>
      </RowCardEnd>
    </RowCard>
  );
}

export default DepositPage;
