import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { Activity, Capability, DocumentCategory } from '@luma/shared';
import {
  ChevronRight,
  Gauge,
  Image,
  Package,
  Ruler,
  Target,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { AddCrewDrawer } from '@/components/crew/add-crew-drawer';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { Can } from '@/components/permissions/can';
import { PageLayout } from '@/components/layout/page-layout';
import { DeleteProjectSection } from '@/components/projects/delete-project-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useBudget } from '@/hooks/budget/use-budget-queries';
import { useProjectDocuments } from '@/hooks/documents/use-document-queries';
import { useCrewMembers } from '@/hooks/crew/use-crew-queries';
import { useDayAttendance } from '@/hooks/labor/use-labor-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { useProviders } from '@/hooks/providers/use-provider-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useProject, useUpdateProject } from '@/hooks/projects/use-project-queries';
import { Switch } from '@/components/ui/switch';
import { activitiesOnDay, summarizeDayAttendance } from '@/lib/attendance';
import { formatMoney } from '@/lib/format-money';
import { organizeMaterials } from '@/lib/materials';
import { iconForSpecialty } from '@/lib/specialty-icons';
import { cn } from '@/lib/utils';
import { isOpenTask, tasksForWeek, weightedProgress } from '@/lib/task-board';
import { currentWeekRange, isActivityOverdue } from '@/lib/week';
import {
  projectActivitiesPath,
  projectBudgetPath,
  projectDocumentsPath,
  projectLaborPath,
  projectMaterialPath,
  projectMaterialsPath,
  projectProvidersPath,
  projectTeamPath,
} from '@/lib/routes';

/**
 * Tope de ítems en las tarjetas que listan. Sin él, una obra con veinte
 * materiales pendientes hace una tarjeta larguísima que desbalancea la
 * columna entera — y para ver todo ya está el enlace "Ver todo".
 */
const CARD_PREVIEW_COUNT = 5;

/**
 * Renders y planos se miran para saber que están cargados y cuál es el último,
 * no para recorrerlos: tres alcanzan, y la lista completa vive en
 * Documentación.
 */
const DOCUMENT_PREVIEW_COUNT = 3;

/**
 * Tareas abiertas en la card: tres, como los documentos. La card dice cómo
 * viene la semana; la lista entera vive en el Tablero.
 */
const TASKS_PREVIEW_COUNT = 3;

/** Ícono de sección en círculo, a la izquierda del título de cada card del dashboard. */
function CardIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-brand">
      <Icon className="size-4" />
    </div>
  );
}

/**
 * Owner-only. Es la única excepción a la regla 4 (el cliente no ve
 * información operativa interna), así que se decide obra por obra y queda
 * apagado por default.
 */
function ProvidersVisibilitySwitch({
  projectId,
  checked,
}: {
  projectId: string;
  checked: boolean;
}) {
  const { t } = useTranslation();
  const updateProject = useUpdateProject(projectId);

  return (
    <Switch
      checked={checked}
      disabled={updateProject.isPending}
      onCheckedChange={(next) => updateProject.mutate({ providersVisibleToClient: next })}
      aria-label={t('project.detail.providersVisibleToClient')}
    />
  );
}

function PurchasesVisibilitySwitch({
  projectId,
  checked,
}: {
  projectId: string;
  checked: boolean;
}) {
  const { t } = useTranslation();
  const updateProject = useUpdateProject(projectId);

  return (
    <Switch
      checked={checked}
      disabled={updateProject.isPending}
      onCheckedChange={(next) => updateProject.mutate({ purchasesVisibleToClient: next })}
      aria-label={t('project.detail.purchasesVisibleToClient')}
    />
  );
}

/**
 * % de avance (RF-04): días de tareas completadas sobre días de tareas no
 * canceladas.
 *
 * Ponderado por duración, no por cantidad: desde que las tareas cortas del
 * Tablero también son actividades, contar de a una hacía que veinte tareas de
 * un día pesaran lo mismo que "Estructura de hormigón". La duración sale de
 * las fechas —no hay un campo de peso que mantener—.
 */
function ProgressCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useAllActivities(projectId);

  const { percent, completed, total } = useMemo(
    () => weightedProgress(data?.activities ?? []),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <CardIcon icon={Gauge} />
        <CardTitle className="text-base">{t('project.dashboard.progress')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-semibold">{percent}%</p>
          <p className="text-xs text-muted-foreground">
            {t('project.dashboard.progressCount', { completed, total })}
          </p>
        </div>
        <Progress value={percent} />
      </CardContent>
    </Card>
  );
}

/**
 * Las mismas dos pestañas que Compras, resumidas: sólo el nombre de cada
 * material. Cada uno lleva a su fila en Compras, que es donde están la
 * cantidad, el proveedor y las acciones. Abre en "Por comprar", igual que la
 * pantalla: es lo que puede frenar una actividad.
 */
function MaterialsCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useMaterials(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

  const { toBuy, bought } = useMemo(() => {
    const activityById = new Map(
      (activitiesData?.activities ?? []).map((activity) => [
        activity.id,
        { name: activity.name, startDate: activity.startDate },
      ]),
    );
    return organizeMaterials(data?.materials ?? [], activityById);
  }, [data, activitiesData]);

  const tabs = [
    { value: 'toBuy', label: t('material.list.toBuy'), items: toBuy, empty: t('material.list.toBuyEmpty') },
    { value: 'bought', label: t('material.list.bought'), items: bought, empty: t('project.dashboard.noPurchases') },
  ] as const;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Package} />
          <CardTitle className="text-base">{t('project.dashboard.purchases')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectMaterialsPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="toBuy" className="gap-3">
          <TabsList className="w-full">
            {/*
              `text-xs`: en tres columnas la card deja ~230px de contenido, y
              los dos rótulos con su conteo a `text-sm` no entran.
            */}
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="px-1.5 text-xs">
                {tab.label} ({tab.items.length})
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tab.empty}</p>
              ) : (
                <ul className="flex flex-col">
                  {tab.items.slice(0, CARD_PREVIEW_COUNT).map((material) => (
                    <li key={material.id}>
                      <Link
                        to={projectMaterialPath(projectId, material.id)}
                        className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="truncate">{material.name}</span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * Tareas de la semana: lo que cae en esta semana más lo atrasado de antes.
 * Reemplazó a la card de Personal, que mostraba la asistencia por actividad y
 * casi siempre decía `0 / 0`.
 *
 * Una tarea es una actividad: son las mismas que el Cronograma, recortadas a
 * esta semana. Las canceladas no cuentan, igual que en el avance general. Las
 * atrasadas se dicen aparte: son lo primero que hay que resolver.
 *
 * Lo del personal —sumar gente, quién falta hoy— sólo para quien ve el
 * personal (`crew.read`). El cliente ve las tareas, no la cuadrilla.
 */
function WeekTasksCard({
  projectId,
  canSeeCrew,
}: {
  projectId: string;
  canSeeCrew: boolean;
}) {
  const { t } = useTranslation();
  // Cada render y no memorizados: una pestaña abierta de domingo a lunes
  // tiene que pasar a la semana nueva. Son baratos.
  const week = currentWeekRange();
  const today = toDayKey(new Date());
  const [addCrewOpen, setAddCrewOpen] = useState(false);

  const { data: activitiesData } = useAllActivities(projectId);
  const { data: crewData } = useCrewMembers(canSeeCrew ? projectId : undefined);
  const { data: attendanceData } = useDayAttendance(canSeeCrew ? projectId : undefined, today);

  const { done, total, overdue, open } = useMemo(() => {
    const tasks = tasksForWeek(activitiesData?.activities ?? [], week, {
      includeOverdue: true,
    }).filter((task) => task.status !== 'cancelada');
    const isLate = (task: Activity) => isActivityOverdue(task.endDate, task.status, today);
    return {
      done: tasks.filter((task) => task.status === 'completada').length,
      total: tasks.length,
      overdue: tasks.filter(isLate).length,
      // Lo atrasado primero, después lo que vence antes.
      open: tasks
        .filter((task) => isOpenTask(task.status))
        .sort((a, b) =>
          isLate(a) !== isLate(b) ? (isLate(a) ? -1 : 1) : a.endDate.localeCompare(b.endDate),
        )
        .slice(0, TASKS_PREVIEW_COUNT),
    };
    // `week` es un objeto nuevo en cada render: la dependencia es su `from`,
    // que define la semana entera.
  }, [activitiesData, week.from, today]);

  const { missing } = useMemo(
    () =>
      summarizeDayAttendance(
        activitiesOnDay(activitiesData?.activities ?? [], today),
        attendanceData?.attendance ?? [],
      ),
    [activitiesData, attendanceData, today],
  );

  const noCrew = canSeeCrew && crewData !== undefined && crewData.crewMembers.length === 0;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Target} />
          <CardTitle className="text-base">{t('project.dashboard.tasks')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          {/* El Tablero es del que ve el personal; el resto, al Cronograma. */}
          <Link to={canSeeCrew ? projectLaborPath(projectId) : projectActivitiesPath(projectId)}>
            {t('project.dashboard.viewAll')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!activitiesData ? null : total === 0 ? (
          noCrew ? (
            <>
              <p className="text-sm text-muted-foreground">{t('project.dashboard.noCrew')}</p>
              <Can I="crew.create">
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setAddCrewOpen(true)}
                >
                  <UserPlus className="size-4" />
                  {t('crew.add.button')}
                </Button>
              </Can>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('project.dashboard.noTasks')}</p>
          )
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-2xl font-semibold tabular-nums">
                {done}
                <span className="text-base text-muted-foreground"> / {total}</span>
              </p>
              <p className={cn('text-xs', overdue > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {overdue > 0
                  ? t('project.dashboard.tasksOverdue', { count: overdue })
                  : t('project.dashboard.tasksCount', { done, total })}
              </p>
            </div>
            <Progress value={percent} />
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('project.dashboard.tasksAllDone')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {open.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{task.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.responsible.name}
                      </p>
                    </div>
                    <ActivityStatusBadge status={task.status} endDate={task.endDate} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {canSeeCrew && missing > 0 && (
          <Link
            to={projectLaborPath(projectId, 'day')}
            className="text-sm text-destructive underline-offset-4 hover:underline"
          >
            {t('project.dashboard.missingToday', { count: missing })}
          </Link>
        )}
      </CardContent>

      {canSeeCrew && (
        <AddCrewDrawer projectId={projectId} open={addCrewOpen} onOpenChange={setAddCrewOpen} />
      )}
    </Card>
  );
}

/**
 * Renders o planos de la obra: una vista de la Documentación filtrada por
 * categoría, no una entidad aparte. Las dos cards son la misma con otro
 * filtro, por eso comparten componente.
 */
function DocumentsCard({
  projectId,
  category,
  icon,
}: {
  projectId: string;
  category: Extract<DocumentCategory, 'render' | 'plano'>;
  icon: ComponentType<{ className?: string }>;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { data } = useProjectDocuments(projectId);

  const latest = useMemo(
    () =>
      (data?.documents ?? [])
        .filter((document) => document.category === category)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, DOCUMENT_PREVIEW_COUNT),
    [data, category],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={icon} />
          <CardTitle className="text-base">{t(`document.category.${category}`)}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={`${projectDocumentsPath(projectId)}?category=${category}`}>
            {t('project.dashboard.viewAll')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(`project.dashboard.noDocuments.${category}`)}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {latest.map((document) => (
              <li key={document.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{document.title}</p>
                  {document.space && (
                    <p className="truncate text-xs text-muted-foreground">{document.space}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(document.createdAt), 'PP', { locale: dateLocale })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Se muestra con `provider.read`: gerente y supervisor siempre, el cliente
 * sólo si la obra lo habilitó (regla 4 — información operativa interna). La
 * excepción vive en la grilla, no acá.
 */
function ProvidersCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useProviders(projectId);

  const providers = data?.providers ?? [];
  const preview = providers.slice(0, CARD_PREVIEW_COUNT);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Wrench} />
          <CardTitle className="text-base">{t('project.dashboard.providers')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectProvidersPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noProviders')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {preview.map((provider) => {
              // El ícono del rubro se lee antes que el texto: sirve para
              // encontrar al electricista sin leer la columna entera.
              const SpecialtyIcon = iconForSpecialty(provider.specialty);
              return (
                <li key={provider.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <SpecialtyIcon className="size-4 shrink-0 text-muted-foreground" />
                    <p className="truncate font-medium">{provider.name}</p>
                  </div>
                  <Badge>
                    {provider.specialty === 'otra'
                      ? provider.customSpecialty
                      : t(`provider.specialty.${provider.specialty}`)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Owner-only — presupuesto no lo ve el cliente invitado (ver project-budget.tsx). */
function BudgetSummaryCard({ projectId, currency }: { projectId: string; currency: string }) {
  const { t, i18n } = useTranslation();
  const { data } = useBudget(projectId);

  const total = data?.budget?.totalAmount ?? 0;
  const committed = data?.committedAmount ?? 0;
  const available = total - committed;
  // Sin presupuesto cargado no hay porcentaje posible: dividir por cero daría
  // NaN y la barra quedaría en blanco sin explicar por qué.
  const committedPercent = total > 0 ? Math.round((committed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Wallet} />
          <CardTitle className="text-base">{t('project.dashboard.budget')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectBudgetPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!data?.budget ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noBudget')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('budget.summary.total')}</dt>
                <dd className="text-lg font-semibold">
                  {formatMoney(data.budget.totalAmount, currency, i18n.language)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('budget.summary.available')}</dt>
                <dd
                  className={cn(
                    'text-lg font-semibold',
                    available < 0 && 'text-destructive',
                  )}
                >
                  {formatMoney(available, currency, i18n.language)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {t('budget.summary.committed')}
                </span>
                <span className="tabular-nums">
                  {formatMoney(committed, currency, i18n.language)}{' '}
                  <span className="text-muted-foreground">({committedPercent}%)</span>
                </span>
              </div>
              {/*
                Mide lo comprometido con proveedores contra el total, no el
                avance de la obra: son dos cosas distintas y juntarlas en una
                sola barra haría creer que gastar es progresar.
              */}
              <Progress value={Math.min(committedPercent, 100)} />
              <p className="text-2xs text-muted-foreground">
                {t('budget.summary.committedHint')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProject(projectId);
  const dateLocale = useDateLocale();

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  const { project, members } = data;
  const capabilities = new Set<Capability>(project.capabilities);
  const can = (capability: Capability) => capabilities.has(capability);

  return (
    /*
     * Masonry por columnas CSS y no grid.
     *
     * Con `grid` las tarjetas se acomodan en filas, y como tienen alturas muy
     * distintas (Materiales lista seis ítems, Presupuesto son dos cifras) cada
     * fila incompleta dejaba huecos negros: siete tarjetas en tres columnas
     * son dos filas llenas y una huérfana. Las columnas CSS empaquetan sin
     * huecos sea cual sea la cantidad, que cambia según el rol —el cliente no
     * ve presupuesto ni proveedores—.
     *
     * El orden del DOM es el de prioridad, y como las columnas se llenan de
     * arriba hacia abajo, lo primero es lo que queda arriba a la izquierda.
     * Es el orden que pidió el cliente: cómo viene la obra (avance), lo que
     * se muestra al cliente (renders y planos), las tareas de la semana, la
     * plata, las compras y con quién se trabaja; y recién al final la
     * ficha y el equipo. Al dashboard se entra a ver el estado, no a releer la
     * descripción —qué obra es ya lo dice el breadcrumb—.
     */
    <PageLayout width="full">
    <div className="columns-1 gap-4 lg:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {/* Cómo viene la obra. */}
      <ProgressCard projectId={project.id} />

      {/* Lo que se le muestra al cliente: la documentación que más se consulta. */}
      {can('document.read') && (
        <DocumentsCard projectId={project.id} category="render" icon={Image} />
      )}
      {can('document.read') && (
        <DocumentsCard projectId={project.id} category="plano" icon={Ruler} />
      )}

      {/*
        El trabajo de la semana, la plata y las compras. "Tareas de la semana"
        ocupa el lugar del viejo "Plan de trabajo": listaban la misma entidad
        —las tareas— y dos cards con lo mismo es una de más.
      */}
      {can('activity.read') && (
        <WeekTasksCard projectId={project.id} canSeeCrew={can('crew.read')} />
      )}
      {can('budget.read') && <BudgetSummaryCard projectId={project.id} currency={project.currency} />}
      {can('material.read') && <MaterialsCard projectId={project.id} />}

      {/* Con quién se trabaja. */}
      {can('provider.read') && <ProvidersCard projectId={project.id} />}

      {/* La ficha y el directorio: consulta, no urgencia. */}
      <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{project.location}</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">{project.description}</p>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('project.fields.startDate')}</dt>
                <dd>{format(fromDayKey(project.estimatedStartDate), 'PP', { locale: dateLocale })}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('project.fields.endDate')}</dt>
                <dd>{format(fromDayKey(project.estimatedEndDate), 'PP', { locale: dateLocale })}</dd>
              </div>
              {project.size && (
                <div>
                  <dt className="text-muted-foreground">{t('project.fields.size')}</dt>
                  <dd>{project.size}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">{t('project.fields.currency')}</dt>
                <dd>{project.currency}</dd>
              </div>
            </dl>

            {can('project.update') && (
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div>
                  <h3 className="text-sm font-medium">
                    {t('project.detail.providersVisibleToClient')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('project.detail.providersVisibleToClientHint')}
                  </p>
                </div>
                <ProvidersVisibilitySwitch
                  projectId={project.id}
                  checked={project.providersVisibleToClient}
                />
              </div>
            )}

            {can('project.update') && (
              <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
                <div>
                  <h3 className="text-sm font-medium">
                    {t('project.detail.purchasesVisibleToClient')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('project.detail.purchasesVisibleToClientHint')}
                  </p>
                </div>
                <PurchasesVisibilitySwitch
                  projectId={project.id}
                  checked={project.purchasesVisibleToClient}
                />
              </div>
            )}

          </CardContent>
        </Card>


      {/* El equipo, resumido. Dar y sacar accesos vive en su propia pantalla:
          es una tarea con su propio momento, no algo con lo que uno se
          tropieza mientras mira cómo viene la obra. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardIcon icon={Users} />
            <CardTitle className="text-base">{t('project.detail.team')}</CardTitle>
          </div>
          <Can I="project.invite">
            <Button variant="ghost" size="sm" asChild>
              <Link to={projectTeamPath(project.id)}>{t('project.team.manage')}</Link>
            </Button>
          </Can>
        </CardHeader>
        <CardContent>
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{member.email}</span>
                </div>
                <Badge className="shrink-0">
                  {t(`project.role.${member.role}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Can I="project.delete">
        <DeleteProjectSection projectId={project.id} projectName={project.name} />
      </Can>
    </div>
    </PageLayout>
  );
}

export default ProjectDetailPage;
