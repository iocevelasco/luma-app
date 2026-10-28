import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  actionsOwnedBy,
  type ActivityPeriod,
  type PlatformActivityReport,
  type PlatformActivityRole,
} from '@luma/shared';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Una sección por rol: arriba cuántas personas distintas hicieron algo y abajo
 * la cantidad de cada acción. "Otras acciones" junta lo que ese rol hizo y no
 * es suyo por defecto (un gerente que carga un gasto), para que el total sea
 * honesto. El umbral y la supresión los decide la API; acá sólo se muestra.
 */
export function ActivityTable({
  report,
  period,
}: {
  report: PlatformActivityReport;
  period: ActivityPeriod;
}) {
  const { t, i18n } = useTranslation();
  const format = (value: number) => value.toLocaleString(i18n.language);

  function rows(item: PlatformActivityRole) {
    if (item.readOnly || !item.periods) {
      return (
        <TableRow>
          <TableCell colSpan={2} className="text-muted-foreground">
            {t('platform.activity.readOnlyNote')}
          </TableCell>
        </TableRow>
      );
    }
    const cell = item.periods[period];
    if (cell.suppressed || !cell.actions) return null;

    const owned = actionsOwnedBy(item.role);
    const sum = (keys: string[]) =>
      keys.reduce((total, key) => total + (cell.actions?.[key as keyof typeof cell.actions] ?? 0), 0);
    const ownedTotal = sum(owned);
    const all = sum(Object.keys(cell.actions));

    if (item.role === 'exMiembro') {
      return (
        <TableRow>
          <TableCell>{t('platform.activity.totalActions')}</TableCell>
          <TableCell className="text-right tabular-nums">{format(all)}</TableCell>
        </TableRow>
      );
    }
    return (
      <>
        {owned.map((action) => (
          <TableRow key={action}>
            <TableCell>{t(`platform.activity.actions.${action}`)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {format(cell.actions![action])}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="text-muted-foreground">{t('platform.activity.otherActions')}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">
            {format(all - ownedTotal)}
          </TableCell>
        </TableRow>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.activity.columns.action')}</TableHead>
                <TableHead className="text-right">{t('platform.activity.columns.count')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.roles.map((item) => {
                const cell = item.periods?.[period];
                return (
                  <Fragment key={item.role}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead scope="rowgroup" className="text-foreground">
                        {t(`platform.activity.roles.${item.role}`)}
                      </TableHead>
                      <TableHead className="text-right font-normal tabular-nums text-muted-foreground">
                        {cell?.suppressed
                          ? t('platform.activity.fewData')
                          : cell && cell.people !== null
                            ? t('platform.activity.people', { count: cell.people })
                            : null}
                      </TableHead>
                    </TableRow>
                    {rows(item)}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        {t('platform.activity.footnote', { min: report.minPeople })}
      </p>
    </div>
  );
}
