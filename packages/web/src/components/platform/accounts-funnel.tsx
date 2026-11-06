import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { PlatformFunnel } from '@luma/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDateLocale } from '@/hooks/use-date-locale';
import { fromDayKey } from '@/lib/day-key';
import { cn } from '@/lib/utils';

/** Cuántos puntos de la cohorte se pintan como máximo: el relleno más oscuro es el 100 %. */
const HEAT_MAX_OPACITY = 0.5;

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Dónde se caen las cuentas con membresía entre el alta y su primer gasto o
 * cobro. Cada barra es cuántas llegaron a esa etapa (una cadena: para llegar a
 * una hay que haber pasado por las anteriores) y la tasa es contra la etapa
 * anterior. Las cohortes miran lo mismo por semana de alta: las recientes
 * todavía no tuvieron tiempo de avanzar.
 */
export function AccountsFunnel({ funnel }: { funnel: PlatformFunnel }) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const { stages, cohorts, active7d } = funnel;
  const number = (value: number) => value.toLocaleString(i18n.language);
  const weekLabel = (weekStart: string) => format(fromDayKey(weekStart), 'd MMM', { locale });

  const total = stages[0]?.count ?? 0;
  const byStage = Object.fromEntries(stages.map((entry) => [entry.stage, entry.count]));
  const stuck = (byStage.emailConfirmed ?? 0) - (byStage.firstProject ?? 0);

  // La mayor caída entre dos etapas seguidas, solo si hubo alguna.
  const drops = stages.slice(1).map((entry, index) => stages[index].count - entry.count);
  const worst = Math.max(0, ...drops);
  const worstStage = worst > 0 ? stages[drops.indexOf(worst) + 1].stage : null;

  const kpis = [
    { key: 'registered', value: number(total), tone: 'text-brand' },
    { key: 'project', value: `${percent(byStage.firstProject ?? 0, total)}%`, tone: '' },
    { key: 'money', value: `${percent(byStage.firstMoney ?? 0, total)}%`, tone: '' },
    { key: 'active', value: number(active7d), tone: '' },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ key, value, tone }) => (
          <Card key={key} className="gap-1 px-5 py-4 sm:gap-1 sm:py-4">
            <dt className="text-xs text-muted-foreground">{t(`platform.funnel.kpi.${key}.title`)}</dt>
            <dd className={cn('text-2xl font-medium tabular-nums', tone)}>{value}</dd>
            <dd className="text-xs text-muted-foreground">{t(`platform.funnel.kpi.${key}.hint`)}</dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('platform.funnel.steps.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('platform.funnel.steps.subtitle')}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3">
              {stages.map((entry, index) => (
                <li key={entry.stage} className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="flex size-7 items-center justify-center rounded-md bg-muted font-mono text-xs">
                    {index + 1}
                  </span>
                  <span className="text-sm">{t(`platform.funnel.stages.${entry.stage}`)}</span>
                  <span className="font-mono text-sm tabular-nums">{number(entry.count)}</span>
                  <div className="col-start-2 h-7 overflow-hidden rounded-md bg-muted">
                    <div
                      className="h-full rounded-md bg-primary"
                      style={{ width: `${percent(entry.count, total)}%` }}
                    />
                  </div>
                  <div className="col-start-3 text-right">
                    {index > 0 && (
                      <Badge variant={entry.stage === worstStage ? 'danger' : 'neutral'}>
                        {percent(entry.count, stages[index - 1].count)}%
                        {entry.stage === worstStage && ` · ${t('platform.funnel.steps.biggestDrop')}`}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {stuck > 0 && (
              <p className="rounded-lg bg-background p-3 text-sm">
                {t('platform.funnel.steps.stuck', { count: stuck })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('platform.funnel.cohorts.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('platform.funnel.cohorts.subtitle')}</p>
          </CardHeader>
          <CardContent>
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="text-left font-normal">
                    {t('platform.funnel.cohorts.week')}
                  </th>
                  <th scope="col" className="font-normal">
                    {t('platform.funnel.cohorts.size')}
                  </th>
                  {stages.slice(1).map((entry, index) => (
                    <th
                      key={entry.stage}
                      scope="col"
                      className="font-normal"
                      title={t(`platform.funnel.stages.${entry.stage}`)}
                    >
                      {index + 2}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.weekStart}>
                    <th scope="row" className="whitespace-nowrap text-left font-normal">
                      {weekLabel(cohort.weekStart)}
                    </th>
                    <td className="text-center tabular-nums">{cohort.size}</td>
                    {cohort.reached.slice(1).map((reached, index) => {
                      const value = percent(reached, cohort.size);
                      return (
                        <td key={stages[index + 1].stage} className="relative text-center tabular-nums">
                          <span
                            aria-hidden
                            className="absolute inset-0 rounded-sm bg-primary"
                            style={{ opacity: (value / 100) * HEAT_MAX_OPACITY }}
                          />
                          <span className="relative block py-2">
                            {cohort.size > 0 ? `${value}%` : '–'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">{t('platform.funnel.cohorts.note')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
