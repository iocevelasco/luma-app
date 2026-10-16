import { useMemo, useState } from 'react';

import { ChevronLeft, ChevronRight, UserPlus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { TaskBoard } from '@/components/activities/task-board';
import { AddCrewDrawer } from '@/components/crew/add-crew-drawer';
import { PageLayout } from '@/components/layout/page-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityAttendance } from '@/components/labor/activity-attendance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useDayAttendance } from '@/hooks/labor/use-labor-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { activitiesOnDay, summarizeDayAttendance } from '@/lib/attendance';
import type { ProjectLaborTab } from '@/lib/routes';

function shiftDay(date: string, deltaDays: number): string {
  const d = fromDayKey(date);
  d.setDate(d.getDate() + deltaDays);
  return toDayKey(d);
}

/** Un valor desconocido en `?tab=` cae en el Tablero: es la vista principal. */
function tabFrom(value: string | null): ProjectLaborTab {
  return value === 'day' ? 'day' : 'board';
}

export function ProjectLaborPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { can } = useProjectCapabilities(projectId);
  const [date, setDate] = useState(() => toDayKey(new Date()));
  const [searchParams, setSearchParams] = useSearchParams();
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);

  const tab = tabFrom(searchParams.get('tab'));

  const { data: allActivitiesData, isLoading, isError } = useAllActivities(projectId);
  const { data: attendanceData } = useDayAttendance(projectId, date);

  const activitiesToday = useMemo(
    () => activitiesOnDay(allActivitiesData?.activities ?? [], date),
    [allActivitiesData, date],
  );

  const attendanceByActivity = useMemo(() => {
    const map = new Map<string, (typeof list)[number]>();
    const list = attendanceData?.attendance ?? [];
    for (const item of list) map.set(item.activityId, item);
    return map;
  }, [attendanceData]);

  const {
    present: totalPresentToday,
    expected: totalExpectedToday,
    missing: totalMissingToday,
  } = useMemo(
    () => summarizeDayAttendance(activitiesToday, attendanceData?.attendance ?? []),
    [activitiesToday, attendanceData],
  );

  if (isError) return <PageLayout isError />;
  if (isLoading || !allActivitiesData) return <PageLayout isLoading />;

  const isToday = date === toDayKey(new Date());

  return (
    /*
      Dos preguntas distintas con su propio navegador de fecha: qué tiene que
      lograr cada uno (el Tablero, por semana) y quién vino (la Jornada, por
      día). El Tablero es la principal y va primero; la Jornada es la
      consulta del día. Mezclarlas en una sola vista dejaría dos calendarios
      compitiendo en la misma pantalla.

      La pestaña va en la URL (`?tab=day`) para que el aviso de faltantes de
      la card del detalle abra la Jornada directo. `replace`: cambiar de
      pestaña no es navegar, y "atrás" tiene que volver a la pantalla
      anterior.

      Las pestañas van en la barra de arriba, a la izquierda; "Agregar
      personal" es la acción principal y "Personal fijo" la de segundo orden,
      a su izquierda. El Tablero necesita el ancho entero para sus columnas.
    */
    <Tabs
      value={tab}
      onValueChange={(value) =>
        setSearchParams(value === 'day' ? { tab: 'day' } : {}, { replace: true })
      }
    >
      <PageLayout
        width="full"
        toolbar={
          <TabsList>
            <TabsTrigger value="board">{t('labor.tabs.board')}</TabsTrigger>
            <TabsTrigger value="day">{t('labor.tabs.day')}</TabsTrigger>
          </TabsList>
        }
        secondaryActions={
          can('crew.create') ? (
            <Button variant="outline" onClick={() => setRosterOpen(true)}>
              <Users className="size-4" />
              {t('crew.list.title')}
            </Button>
          ) : undefined
        }
        action={
          can('crew.create') ? (
            <Button onClick={() => setAddCrewOpen(true)}>
              <UserPlus className="size-4" />
              {t('crew.add.button')}
            </Button>
          ) : undefined
        }
      >
        <TabsContent value="board">
          <TaskBoard
            projectId={projectId!}
            rosterOpen={rosterOpen}
            onRosterOpenChange={setRosterOpen}
          />
        </TabsContent>

        <TabsContent value="day" className="flex w-full max-w-3xl flex-col gap-6">
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
              canMarkAttendance={can('crew.attendance.write')}
              canManageCrew={can('crew.manage')}
            />
          ))
        )}
      </div>
        </TabsContent>

        <AddCrewDrawer projectId={projectId!} open={addCrewOpen} onOpenChange={setAddCrewOpen} />
      </PageLayout>
    </Tabs>
  );
}

export default ProjectLaborPage;
