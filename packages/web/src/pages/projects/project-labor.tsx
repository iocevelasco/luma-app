import { useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { CrewGoalsPanel } from '@/components/crew/crew-goals-panel';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityAttendance } from '@/components/labor/activity-attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useDayAttendance } from '@/hooks/labor/use-labor-queries';
import { useProject } from '@/hooks/projects/use-project-queries';

function shiftDay(date: string, deltaDays: number): string {
  const d = fromDayKey(date);
  d.setDate(d.getDate() + deltaDays);
  return toDayKey(d);
}

export function ProjectLaborPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const [date, setDate] = useState(() => toDayKey(new Date()));

  const { data: allActivitiesData, isLoading, isError } = useAllActivities(projectId);
  const { data: attendanceData } = useDayAttendance(projectId, date);

  const isEditor = Boolean(projectData?.project.isEditor);

  const activitiesToday = useMemo(() => {
    if (!allActivitiesData) return [];
    return allActivitiesData.activities.filter(
      (activity) => activity.startDate <= date && date <= activity.endDate,
    );
  }, [allActivitiesData, date]);

  const attendanceByActivity = useMemo(() => {
    const map = new Map<string, (typeof list)[number]>();
    const list = attendanceData?.attendance ?? [];
    for (const item of list) map.set(item.activityId, item);
    return map;
  }, [attendanceData]);

  /**
   * Totales de la obra. Los partes viejos no tienen gente del roster, así que
   * su presente sale de los nombres tipeados y su esperado del número que se
   * cargaba a mano — si no, esos días aparecerían en cero.
   */
  const { totalPresentToday, totalExpectedToday } = useMemo(() => {
    let present = 0;
    let expected = 0;
    for (const activity of activitiesToday) {
      const item = attendanceByActivity.get(activity.id);
      if (!item) continue;
      const fromRoster = item.presentCrewMemberIds.length;
      present += fromRoster > 0 ? fromRoster : item.legacyPresentNames.length;
      expected += item.expected.length > 0 ? item.expected.length : item.legacyExpectedCount;
    }
    return { totalPresentToday: present, totalExpectedToday: expected };
  }, [activitiesToday, attendanceByActivity]);

  const totalMissingToday = Math.max(totalExpectedToday - totalPresentToday, 0);

  if (isError) return <RouteError />;
  if (isLoading || !allActivitiesData) return <RouteLoading />;

  const isToday = date === toDayKey(new Date());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-3 md:p-4">
      {/*
        Dos preguntas distintas con su propio navegador de fecha: quién está
        HOY (asistencia, por día) y qué tiene que lograr cada uno esta SEMANA
        (metas, cargadas una o dos semanas antes). Mezclarlas en una sola
        vista dejaría dos calendarios compitiendo en la misma pantalla.
      */}
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">{t('labor.tabs.attendance')}</TabsTrigger>
          <TabsTrigger value="goals">{t('labor.tabs.goals')}</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="pt-4">
          <CrewGoalsPanel
            projectId={projectId!}
            isEditor={isEditor}
            isOwner={Boolean(projectData?.project.isOwner)}
          />
        </TabsContent>

        <TabsContent value="attendance" className="flex flex-col gap-8 pt-4">
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

      {/*
        El resumen de la obra entera arriba: la primera pregunta de la mañana
        es con cuánta gente se cuenta hoy. Antes había que sumar a ojo fila
        por fila, y la lista de presentes repetía lo mismo que el formulario.
      */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-2xs text-muted-foreground">{t('labor.summary.present')}</p>
          <p className="text-2xl font-semibold tabular-nums">
            {totalPresentToday}
            <span className="text-base text-muted-foreground"> / {totalExpectedToday}</span>
          </p>
        </div>
        {totalMissingToday > 0 && (
          <div>
            <p className="text-2xs text-muted-foreground">{t('labor.summary.missing')}</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {totalMissingToday}
            </p>
          </div>
        )}
        <div>
          <p className="text-2xs text-muted-foreground">{t('labor.summary.activities')}</p>
          <p className="text-2xl font-semibold tabular-nums">{activitiesToday.length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">{t('labor.byActivityTitle')}</h3>
        {activitiesToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('labor.emptyState')}</p>
        ) : (
          activitiesToday.map((activity) => (
            <ActivityAttendance
              key={activity.id}
              projectId={projectId!}
              activity={activity}
              attendance={attendanceByActivity.get(activity.id)}
              date={date}
              isEditor={isEditor}
            />
          ))
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProjectLaborPage;
