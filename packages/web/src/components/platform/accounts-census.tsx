import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  MEMBERSHIP_BUCKETS,
  MIN_PEOPLE_PER_CELL,
  type MembershipBucket,
  type PlatformCensus,
} from '@luma/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDateLocale } from '@/hooks/use-date-locale';
import { fromDayKey } from '@/lib/day-key';
import { MEMBERSHIP_TONE } from '@/lib/platform-accounts';
import { cn } from '@/lib/utils';

/** El color de cada tramo de la barra: el mismo tono que su Badge. */
const BUCKET_FILL: Record<MembershipBucket, string> = {
  trial: 'bg-tag-info-dot',
  paying: 'bg-tag-success-dot',
  unlimited: 'bg-tag-neutral-dot',
  expired: 'bg-tag-danger-dot',
};

/**
 * Qué cuentas hay y cuáles importan. Solo las que tienen una membresía son
 * clientes de Luma; clientes de obra, empleados y cuentas de prueba se cuentan
 * aparte y no se siguen. Las cifras no se suman entre sí salvo los segmentos,
 * que no se solapan: una persona cuenta en uno solo.
 */
export function AccountsCensus({ census }: { census: PlatformCensus }) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const { segments, memberships, staffRoles, signups } = census;
  const number = (value: number) => value.toLocaleString(i18n.language);
  const weekLabel = (weekStart: string) => format(fromDayKey(weekStart), 'd MMM', { locale });

  const members = segments.membership;
  const withoutMembership = segments.staff + segments.client + segments.noProject;
  const peak = Math.max(1, ...signups.map((week) => week.members + week.others));
  const roleMax = Math.max(1, segments.client, ...staffRoles.map((row) => row.people));
  const ratio = members > 0 ? (withoutMembership / members).toLocaleString(i18n.language, { maximumFractionDigits: 1 }) : null;

  const kpis = [
    { key: 'membership', value: segments.membership, tone: 'text-brand' },
    { key: 'client', value: segments.client, tone: '' },
    { key: 'staff', value: segments.staff, tone: '' },
    { key: 'test', value: census.testAccounts, tone: 'text-muted-foreground' },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t('platform.census.intro', {
          total: number(census.total),
          membership: number(segments.membership),
          client: number(segments.client),
          staff: number(segments.staff),
          noProject: number(segments.noProject),
          inactive: number(segments.inactive),
        })}{' '}
        {t('platform.census.testNote', { count: census.testAccounts })}
      </p>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ key, value, tone }) => (
          <Card key={key} className="gap-1 px-5 py-4 sm:gap-1 sm:py-4">
            <dt className="text-xs text-muted-foreground">{t(`platform.census.kpi.${key}.title`)}</dt>
            <dd className={cn('text-2xl font-medium tabular-nums', tone)}>{number(value)}</dd>
            <dd className="text-xs text-muted-foreground">{t(`platform.census.kpi.${key}.hint`)}</dd>
          </Card>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('platform.census.membership.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('platform.census.membership.subtitle', { count: members })}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {members > 0 && (
            <div
              role="img"
              aria-label={t('platform.census.membership.title')}
              className="flex h-7 gap-0.5 overflow-hidden rounded-md"
            >
              {MEMBERSHIP_BUCKETS.filter((bucket) => memberships[bucket] > 0).map((bucket) => (
                <div
                  key={bucket}
                  className={BUCKET_FILL[bucket]}
                  style={{ flex: memberships[bucket] }}
                />
              ))}
            </div>
          )}
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {MEMBERSHIP_BUCKETS.map((bucket) => (
              <li key={bucket} className="flex items-center gap-2 text-sm">
                <Badge variant={MEMBERSHIP_TONE[bucket]}>{t(`platform.census.membership.${bucket}`)}</Badge>
                <span className="font-mono tabular-nums">{number(memberships[bucket])}</span>
                <span className="text-xs text-muted-foreground">
                  {members > 0 ? `${Math.round((memberships[bucket] / members) * 100)}%` : '–'}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('platform.census.signups.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('platform.census.signups.subtitle', { weeks: signups.length })}
            </p>
          </CardHeader>
          <CardContent>
            <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-xs bg-brand" />
                {t('platform.census.signups.members')}
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-xs bg-muted-foreground/50" />
                {t('platform.census.signups.others')}
              </li>
            </ul>
            <ol className="flex h-36 items-end gap-1.5" aria-label={t('platform.census.signups.label')}>
              {signups.map((week) => {
                const total = week.members + week.others;
                const label = t('platform.census.signups.week', {
                  date: weekLabel(week.weekStart),
                  members: week.members,
                  others: week.others,
                });
                return (
                  <li
                    key={week.weekStart}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    title={label}
                  >
                    <span className="text-2xs tabular-nums text-muted-foreground">{total}</span>
                    <div
                      aria-hidden
                      className="flex w-full flex-col justify-end overflow-hidden rounded-xs"
                      style={{ height: `${Math.max(total === 0 ? 2 : 6, (total / peak) * 100)}%` }}
                    >
                      <div className="bg-brand" style={{ flex: week.members }} />
                      <div className="bg-muted-foreground/50" style={{ flex: week.others }} />
                    </div>
                    <span className="sr-only">{label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 flex justify-between text-2xs text-muted-foreground">
              <span>{weekLabel(signups[0].weekStart)}</span>
              <span>{weekLabel(signups[signups.length - 1].weekStart)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('platform.census.roles.title')}</CardTitle>
            {ratio && (
              <p className="text-xs text-muted-foreground">
                {t('platform.census.roles.subtitle', { ratio })}
              </p>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RoleBar
              label={t('platform.census.roles.client')}
              value={segments.client}
              max={roleMax}
              fill="bg-brand"
            />
            {staffRoles.length > 0 && (
              <>
                <p className="text-2xs uppercase tracking-wide text-muted-foreground">
                  {t('platform.census.roles.staff')}
                </p>
                {staffRoles.map((row) => (
                  <RoleBar
                    key={row.role}
                    label={
                      row.role === 'other'
                        ? t('platform.census.roles.other')
                        : t(`project.role.${row.role}`)
                    }
                    value={row.people}
                    max={roleMax}
                    fill="bg-muted-foreground/60"
                  />
                ))}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {t('platform.census.roles.note', { min: MIN_PEOPLE_PER_CELL })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RoleBar({
  label,
  value,
  max,
  fill,
}: {
  label: string;
  value: number;
  max: number;
  fill: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
