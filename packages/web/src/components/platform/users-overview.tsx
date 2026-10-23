import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { PlatformUsersOverview } from '@luma/shared';
import { fromDayKey } from '@/components/common/date-range-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDateLocale } from '@/hooks/use-date-locale';

const STAT_KEYS = ['total', 'active', 'verified', 'unverified', 'inactive'] as const;

/**
 * Las cinco cifras de arriba de la pantalla y la curva de altas. Las cifras
 * no se suman entre sí: "confirmadas" y "sin confirmar" son un corte de las
 * activas, y "dadas de baja" queda aparte.
 */
export function UsersOverview({ overview }: { overview: PlatformUsersOverview }) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const { stats, signups } = overview;
  const peak = Math.max(1, ...signups.map((week) => week.count));
  const total = signups.reduce((sum, week) => sum + week.count, 0);
  const weekLabel = (weekStart: string) => format(fromDayKey(weekStart), 'd MMM', { locale });

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_KEYS.map((key) => (
          <Card key={key} className="gap-1 px-5 py-4 sm:gap-1 sm:py-4">
            <dt className="text-xs text-muted-foreground">{t(`platform.users.stats.${key}`)}</dt>
            <dd className="text-2xl font-medium tabular-nums">
              {stats[key].toLocaleString(i18n.language)}
            </dd>
          </Card>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('platform.users.signups.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('platform.users.signups.total', { amount: total, weeks: signups.length })}
          </p>
        </CardHeader>
        <CardContent>
          <ol className="flex h-28 items-end gap-1.5" aria-label={t('platform.users.signups.label')}>
            {signups.map((week) => (
              <li
                key={week.weekStart}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={t('platform.users.signups.week', {
                  date: weekLabel(week.weekStart),
                  amount: week.count,
                })}
              >
                <span className="text-2xs tabular-nums text-muted-foreground">{week.count}</span>
                <span
                  aria-hidden
                  className="w-full rounded-xs bg-brand"
                  style={{ height: `${Math.max(week.count === 0 ? 2 : 6, (week.count / peak) * 100)}%` }}
                />
                <span className="sr-only">
                  {t('platform.users.signups.week', {
                    date: weekLabel(week.weekStart),
                    amount: week.count,
                  })}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-between text-2xs text-muted-foreground">
            <span>{weekLabel(signups[0].weekStart)}</span>
            <span>{weekLabel(signups[signups.length - 1].weekStart)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
