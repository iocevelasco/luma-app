import { useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormShell } from '@/components/common/form-shell';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSection, RowCard, RowCardList } from '@/components/common/row-card-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useExchangeRates,
  useRefreshExchangeRate,
  useSaveManualRate,
} from '@/hooks/platform/use-platform-billing-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { fromDayKey } from '@/components/common/date-range-filter';

/**
 * La tasa BCV como la opera el admin: la vigente, leer el BCV ya, cargar una
 * a mano cuando el BCV no responde, y las últimas lecturas (marcadas
 * incluidas, que son las que hay que mirar).
 */
export function ExchangeRatesPanel() {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const { data, isLoading } = useExchangeRates();
  const refresh = useRefreshExchangeRate();
  const save = useSaveManualRate();
  const [usd, setUsd] = useState('');
  const [valueDate, setValueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  if (isLoading) return <LoadingIndicator />;
  const current = data?.current;
  const rate = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 8 });
  const day = (key: string) => format(fromDayKey(key), 'PP', { locale });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t('platform.rates.current')}</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className="size-4" />
            {t('platform.rates.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {current ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl">{rate(current.usd)}</span>
              <span className="text-sm text-muted-foreground">
                {t('platform.rates.valueDate')}: {day(current.valueDate)} ·{' '}
                {t(`platform.rates.source.${current.source}`)}
              </span>
              {current.stale && (
                <Badge className="bg-warning text-warning-foreground">{t('platform.rates.stale')}</Badge>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('platform.rates.none')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('platform.rates.manualTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('platform.rates.manualHint')}</p>
        </CardHeader>
        <CardContent>
          <FormShell
            variant="embedded"
            className="gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate({ usd: Number(usd), valueDate }, { onSuccess: () => setUsd('') });
            }}
            submitLabel={t('platform.rates.save')}
            isSubmitting={save.isPending}
            isDirty={Number(usd) > 0 && Boolean(valueDate)}
            error={save.error}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-usd">{t('platform.rates.usd')}</Label>
                <Input
                  id="manual-usd"
                  type="number"
                  step="0.00000001"
                  inputMode="decimal"
                  value={usd}
                  onChange={(event) => setUsd(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual-date">{t('platform.rates.valueDate')}</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={valueDate}
                  onChange={(event) => setValueDate(event.target.value)}
                />
              </div>
            </div>
          </FormShell>
        </CardContent>
      </Card>

      <ListSection label={t('platform.rates.history')}>
          <RowCardList>
            {(data?.rates ?? []).map((record) => (
              <RowCard key={record.id} className="justify-between gap-2 py-3">
                <span>
                  {day(record.valueDate)} · {t(`platform.rates.source.${record.source}`)}
                </span>
                <span className="flex items-center gap-2">
                  {record.flagged && (
                    <Badge className="bg-warning text-warning-foreground" title={record.flagReason ?? ''}>
                      {t('platform.rates.flagged')}
                    </Badge>
                  )}
                  <span className="font-mono">{rate(record.usd)}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(record.lastSeenAt), 'Pp', { locale })}
                  </span>
                </span>
              </RowCard>
            ))}
          </RowCardList>
      </ListSection>
    </div>
  );
}
