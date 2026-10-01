import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { inviteClientSchema, type InviteClientInput } from '@luma/shared';
import { Gauge, ListChecks, Package, UserPlus, Users, Wallet, Wrench } from 'lucide-react';
import type { ComponentType } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormDrawer } from '@/components/common/form-drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useBudget } from '@/hooks/budget/use-budget-queries';
import { useLaborRecords } from '@/hooks/labor/use-labor-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { useProviders } from '@/hooks/providers/use-provider-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useInviteClient, useProject, useUpdateProject } from '@/hooks/projects/use-project-queries';
import { Switch } from '@/components/ui/switch';
import { formatMoney } from '@/lib/format-money';
import { iconForSpecialty } from '@/lib/specialty-icons';
import { cn } from '@/lib/utils';
import {
  projectActivitiesPath,
  projectBudgetPath,
  projectLaborPath,
  projectMaterialsPath,
  projectProvidersPath,
} from '@/lib/routes';

const MATERIAL_STATUS_PRIORITY = { pendiente: 0, solicitado: 1, comprado: 2, en_obra: 3 } as const;

/**
 * Tope de ítems en las tarjetas que listan. Sin él, una obra con veinte
 * materiales pendientes hace una tarjeta larguísima que desbalancea la
 * columna entera — y para ver todo ya está el enlace "Ver todo".
 */
const CARD_PREVIEW_COUNT = 5;

/** Ícono de sección en círculo, a la izquierda del título de cada card del dashboard. */
function CardIcon({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <Icon className="size-4" />
    </div>
  );
}

function InviteClientDialog({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inviteClient = useInviteClient(projectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteClientInput>({ resolver: zodResolver(inviteClientSchema) });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        {t('project.detail.invite')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={t('project.detail.inviteTitle')}
        fieldCount={1}
        submitLabel={t('project.detail.inviteSubmit')}
        isSubmitting={inviteClient.isPending}
        onSubmit={handleSubmit((values) =>
          inviteClient.mutate(values, {
            onSuccess: () => {
              setOpen(false);
              reset();
            },
          }),
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="client-email">{t('project.detail.inviteEmail')}</Label>
          <Input id="client-email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </FormDrawer>
    </>
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

function PendingTasksCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useAllActivities(projectId);

  const pending = useMemo(() => {
    return (data?.activities ?? [])
      .filter((activity) => activity.status !== 'completada' && activity.status !== 'cancelada')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, CARD_PREVIEW_COUNT);
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={ListChecks} />
          <CardTitle className="text-base">{t('project.dashboard.pendingTasks')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectActivitiesPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noPendingTasks')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((activity) => (
              <li key={activity.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">{activity.area}</p>
                </div>
                <ActivityStatusBadge status={activity.status} endDate={activity.endDate} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * % de avance (RF-04): completadas sobre el total de actividades no
 * canceladas. Sin ponderación por tamaño de actividad — el documento la
 * sugiere, pero no hay campo de "peso" en `Activity` todavía, y agregar uno
 * es una decisión de modelo que no viene pedida.
 */
function ProgressCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useAllActivities(projectId);

  const { percent, completed, relevant } = useMemo(() => {
    const activities = (data?.activities ?? []).filter((activity) => activity.status !== 'cancelada');
    const done = activities.filter((activity) => activity.status === 'completada').length;
    return {
      percent: activities.length === 0 ? 0 : Math.round((done / activities.length) * 100),
      completed: done,
      relevant: activities.length,
    };
  }, [data]);

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
            {t('project.dashboard.progressCount', { completed, total: relevant })}
          </p>
        </div>
        <Progress value={percent} />
      </CardContent>
    </Card>
  );
}

function MaterialsCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useMaterials(projectId);

  const pending = useMemo(() => {
    return (data?.materials ?? [])
      .filter((material) => material.status === 'pendiente' || material.status === 'solicitado')
      .sort((a, b) => MATERIAL_STATUS_PRIORITY[a.status] - MATERIAL_STATUS_PRIORITY[b.status])
      .slice(0, CARD_PREVIEW_COUNT);
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Package} />
          <CardTitle className="text-base">{t('project.dashboard.materials')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectMaterialsPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noMaterialsPending')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((material) => (
              <li key={material.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{material.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {material.quantity} {t(`material.unit.${material.unit}`)}
                  </p>
                </div>
                {/*
                  Rojo sólo lo que todavía no se pidió: eso es lo que puede
                  frenar una actividad. Lo ya solicitado está en camino, y
                  pintarlo igual que lo que nadie encargó borra la diferencia
                  entre "hay que hacer algo" y "hay que esperar".
                */}
                <Badge
                  variant={material.status === 'pendiente' ? 'destructive' : 'default'}
                  className={cn(
                    material.status === 'solicitado' && 'bg-warning text-warning-foreground',
                  )}
                >
                  {t(`material.status.${material.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LaborCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const today = useMemo(() => toDayKey(new Date()), []);
  const { data: activitiesData } = useAllActivities(projectId);
  const { data: laborData } = useLaborRecords(projectId, today);

  const rows = useMemo(() => {
    const recordByActivity = new Map((laborData?.laborRecords ?? []).map((r) => [r.activityId, r]));
    return (activitiesData?.activities ?? [])
      .filter((activity) => activity.startDate <= today && today <= activity.endDate)
      .map((activity) => ({ activity, record: recordByActivity.get(activity.id) }));
  }, [activitiesData, laborData, today]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardIcon icon={Users} />
          <CardTitle className="text-base">{t('project.dashboard.labor')}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectLaborPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noActivitiesToday')}</p>
        ) : (
          // Una sola columna: la tarjeta vive dentro de una columna angosta
          // del masonry, y dos nombres de actividad al lado se pisan.
          <ul className="flex flex-col gap-3">
            {rows.map(({ activity, record }) => {
              const expected = record?.expectedCount ?? 0;
              // `presentCount` en vez de `presentNames.length`: la API vacía
              // los nombres para el cliente invitado, pero la cuenta sigue
              // siendo real — este badge es agregado, no expone a nadie.
              const present = record?.presentCount ?? 0;
              const deficit = expected - present;
              return (
                <li key={activity.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{activity.name}</p>
                    {deficit > 0 && (
                      <p className="text-xs text-destructive">
                        {t('labor.deficit', { count: deficit })}
                      </p>
                    )}
                  </div>
                  {/*
                    La cuenta al frente y en grande: la pregunta de la mañana es
                    "¿cuántos vinieron de los que esperaba?", y antes eso vivía
                    en un texto chico y gris debajo del nombre.
                  */}
                  <p
                    className={cn(
                      'shrink-0 text-base tabular-nums',
                      deficit > 0 ? 'text-destructive' : 'text-foreground',
                    )}
                  >
                    <span className="font-semibold">{present}</span>
                    <span className="text-muted-foreground"> / {expected}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}



/**
 * Dueño o Asistente de Obra — el cliente no ve este módulo (regla 4:
 * información operativa interna). Igual que en `project-tabs.tsx`, se
 * condiciona con `isEditor`, no con `isOwner`.
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
                  <Badge variant="secondary">
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

  if (isError) return <RouteError />;
  if (isLoading || !data) return <RouteLoading />;

  const { project, clients } = data;

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
     * Primero cómo viene la obra (avance y plata), después qué necesita
     * atención, y al final la ficha y el material de consulta: al dashboard
     * se entra a ver el estado, no a releer la descripción —qué obra es ya lo
     * dice el breadcrumb—.
     */
    <div className="columns-1 gap-4 p-3 md:p-4 lg:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
      {/* Cómo viene la obra: las dos cifras que se miran primero. */}
      <ProgressCard projectId={project.id} />
      {project.isOwner && <BudgetSummaryCard projectId={project.id} currency={project.currency} />}

      {/* Qué requiere atención hoy. */}
      <PendingTasksCard projectId={project.id} />
      <MaterialsCard projectId={project.id} />
      <LaborCard projectId={project.id} />

      {/* La ficha y el directorio: consulta, no urgencia. */}
      <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{project.location}</p>
            </div>
            <Badge variant="secondary">{t(`project.budgetType.${project.budgetType}`)}</Badge>
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

            {project.isOwner && (
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

          </CardContent>
        </Card>

      {(project.isEditor || project.providersVisibleToClient) && (
        <ProvidersCard projectId={project.id} />
      )}

      {/* Los clientes, en su propia tarjeta al final: es gente invitada, no
          una propiedad de la obra, y adentro de la ficha la estiraba. */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardIcon icon={Users} />
            <CardTitle className="text-base">{t('project.detail.clients')}</CardTitle>
          </div>
          {project.isOwner && <InviteClientDialog projectId={project.id} />}
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('project.detail.noClients')}</p>
          ) : (
            // Scroll propio: una obra con muchos invitados no puede estirar
            // la tarjeta y desbalancear la columna del masonry.
            <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {clients.map((client) => (
                <li key={client.id} className="flex flex-col text-sm">
                  <span className="font-medium">{client.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{client.email}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectDetailPage;
