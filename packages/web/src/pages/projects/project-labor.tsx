import { useEffect, useMemo, useState } from 'react';
import type { Activity, LaborRecord } from '@luma/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useLaborRecords, useUpsertLaborRecord } from '@/hooks/labor/use-labor-queries';
import { useProject } from '@/hooks/projects/use-project-queries';

function shiftDay(date: string, deltaDays: number): string {
  const d = fromDayKey(date);
  d.setDate(d.getDate() + deltaDays);
  return toDayKey(d);
}

function LaborRow({
  projectId,
  activity,
  record,
  date,
  isOwner,
}: {
  projectId: string;
  activity: Activity;
  record: LaborRecord | undefined;
  date: string;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const upsert = useUpsertLaborRecord(projectId);
  const [expectedCount, setExpectedCount] = useState(record?.expectedCount ?? 0);
  const [presentNamesText, setPresentNamesText] = useState((record?.presentNames ?? []).join(', '));

  // El registro llega async (o cambia al navegar de día) — el form tiene que
  // reflejarlo, no quedarse con el valor default del primer render.
  useEffect(() => {
    setExpectedCount(record?.expectedCount ?? 0);
    setPresentNamesText((record?.presentNames ?? []).join(', '));
  }, [record]);

  const presentNames = presentNamesText
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  // Para el cliente invitado la API vacía `presentNames` (regla de negocio: no
  // ve la asignación individual de personal) — `presentCount` es la cuenta
  // real igual, así el déficit no se calcula contra un array vacío.
  const presentCount = isOwner ? presentNames.length : (record?.presentCount ?? 0);
  const deficit = expectedCount - presentCount;

  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-end">
      <div className="flex-1">
        <p className="font-medium">{activity.name}</p>
        <p className="text-sm text-muted-foreground">{activity.area}</p>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t('labor.fields.expected')}</Label>
        {isOwner ? (
          <Input
            type="number"
            min={0}
            className="w-20"
            value={expectedCount}
            onChange={(event) => setExpectedCount(Number(event.target.value))}
          />
        ) : (
          <p>{expectedCount}</p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t('labor.fields.present')}</Label>
        {isOwner ? (
          <Input
            value={presentNamesText}
            onChange={(event) => setPresentNamesText(event.target.value)}
            placeholder={t('labor.fields.presentPlaceholder')}
          />
        ) : (
          <p>{presentCount > 0 ? t('labor.presentCount', { count: presentCount }) : '—'}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {deficit > 0 && <Badge variant="destructive">{t('labor.deficit', { count: deficit })}</Badge>}
        {isOwner && (
          <Button
            size="sm"
            disabled={upsert.isPending}
            onClick={() =>
              upsert.mutate({ activityId: activity.id, date, expectedCount, presentNames })
            }
          >
            {t('common.save')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectLaborPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const [date, setDate] = useState(() => toDayKey(new Date()));

  const { data: allActivitiesData, isLoading, isError } = useAllActivities(projectId);
  const { data: laborData } = useLaborRecords(projectId, date);

  const isOwner = Boolean(projectData?.project.isOwner);

  const activitiesToday = useMemo(() => {
    if (!allActivitiesData) return [];
    return allActivitiesData.activities.filter(
      (activity) => activity.startDate <= date && date <= activity.endDate,
    );
  }, [allActivitiesData, date]);

  const recordByActivity = useMemo(() => {
    const map = new Map<string, LaborRecord>();
    for (const record of laborData?.laborRecords ?? []) map.set(record.activityId, record);
    return map;
  }, [laborData]);

  // Vacío para el cliente invitado (la API no manda nombres individuales):
  // el total de `totalPresentToday` sigue siendo correcto porque sale de
  // `presentCount`, no de contar este array.
  const presentToday = useMemo(() => {
    const result: { name: string; activityName: string }[] = [];
    for (const activity of activitiesToday) {
      const record = recordByActivity.get(activity.id);
      for (const name of record?.presentNames ?? []) {
        result.push({ name, activityName: activity.name });
      }
    }
    return result;
  }, [activitiesToday, recordByActivity]);

  const totalPresentToday = useMemo(() => {
    return activitiesToday.reduce(
      (sum, activity) => sum + (recordByActivity.get(activity.id)?.presentCount ?? 0),
      0,
    );
  }, [activitiesToday, recordByActivity]);

  if (isError) return <RouteError />;
  if (isLoading || !allActivitiesData) return <RouteLoading />;

  const isToday = date === toDayKey(new Date());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setDate((d) => shiftDay(d, -1))} aria-label={t('labor.prevDay')}>
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="w-auto"
        />
        <Button variant="ghost" size="icon" onClick={() => setDate((d) => shiftDay(d, 1))} aria-label={t('labor.nextDay')}>
          <ChevronRight className="size-4" />
        </Button>
        {!isToday && (
          <Button variant="outline" size="sm" onClick={() => setDate(toDayKey(new Date()))}>
            {t('labor.today')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t('labor.whoIsHereTitle')}</h3>
        {isOwner ? (
          presentToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('labor.whoIsHereEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {presentToday.map((person, index) => (
                <li key={index}>
                  {person.name} <span className="text-muted-foreground">— {person.activityName}</span>
                </li>
              ))}
            </ul>
          )
        ) : totalPresentToday === 0 ? (
          <p className="text-sm text-muted-foreground">{t('labor.whoIsHereEmpty')}</p>
        ) : (
          // El cliente ve el total, no quién en particular — regla de negocio.
          <p className="text-sm">{t('labor.whoIsHereCount', { count: totalPresentToday })}</p>
        )}
      </div>

      <div className="flex flex-col border-t border-border pt-6">
        <h3 className="mb-2 text-sm font-medium">{t('labor.byActivityTitle')}</h3>
        {activitiesToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('labor.emptyState')}</p>
        ) : (
          activitiesToday.map((activity) => (
            <LaborRow
              key={activity.id}
              projectId={projectId!}
              activity={activity}
              record={recordByActivity.get(activity.id)}
              date={date}
              isOwner={isOwner}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ProjectLaborPage;
