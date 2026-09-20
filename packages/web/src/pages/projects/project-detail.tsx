import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { inviteClientSchema, type InviteClientInput } from '@luma/shared';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useBudget } from '@/hooks/budget/use-budget-queries';
import { useLaborRecords } from '@/hooks/labor/use-labor-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useInviteClient, useProject } from '@/hooks/projects/use-project-queries';
import { formatMoney } from '@/lib/format-money';
import { projectActivitiesPath, projectBudgetPath, projectLaborPath, projectMaterialsPath } from '@/lib/routes';
import { isActivityOverdue } from '@/lib/week';

const MATERIAL_STATUS_PRIORITY = { pendiente: 0, solicitado: 1, comprado: 2, en_obra: 3 } as const;

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          {t('project.detail.invite')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('project.detail.inviteTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
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
          <DialogFooter>
            <Button type="submit" disabled={inviteClient.isPending}>
              {inviteClient.isPending ? t('common.loading') : t('project.detail.inviteSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PendingTasksCard({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data } = useAllActivities(projectId);

  const pending = useMemo(() => {
    return (data?.activities ?? [])
      .filter((activity) => activity.status !== 'completada' && activity.status !== 'cancelada')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{t('project.dashboard.pendingTasks')}</CardTitle>
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
                <Badge
                  variant={
                    isActivityOverdue(activity.endDate, activity.status) ? 'destructive' : 'secondary'
                  }
                >
                  {t(`activity.status.${activity.status}`)}
                </Badge>
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
      <CardHeader>
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
      .sort((a, b) => MATERIAL_STATUS_PRIORITY[a.status] - MATERIAL_STATUS_PRIORITY[b.status]);
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{t('project.dashboard.materials')}</CardTitle>
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
                <Badge variant="destructive">{t(`material.status.${material.status}`)}</Badge>
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
        <CardTitle className="text-base">{t('project.dashboard.labor')}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectLaborPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noActivitiesToday')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ activity, record }) => {
              const expected = record?.expectedCount ?? 0;
              // `presentCount` en vez de `presentNames.length`: la API vacía
              // los nombres para el cliente invitado, pero la cuenta sigue
              // siendo real — este badge es agregado, no expone a nadie.
              const present = record?.presentCount ?? 0;
              const deficit = expected - present;
              return (
                <li key={activity.id} className="flex items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{activity.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {present} / {expected} {t('project.dashboard.laborCount')}
                    </p>
                  </div>
                  {deficit > 0 && <Badge variant="destructive">{t('labor.deficit', { count: deficit })}</Badge>}
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{t('project.dashboard.budget')}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={projectBudgetPath(projectId)}>{t('project.dashboard.viewAll')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!data?.budget ? (
          <p className="text-sm text-muted-foreground">{t('project.dashboard.noBudget')}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('budget.summary.total')}</dt>
              <dd className="text-lg font-semibold">
                {formatMoney(data.budget.totalAmount, currency, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('budget.summary.contingency')}</dt>
              <dd className="text-lg font-semibold">
                {formatMoney(data.budget.contingencyAmount, currency, i18n.language)}
              </dd>
            </div>
          </dl>
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
    <div className="flex flex-col gap-4 p-3 md:p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-medium">{t('project.detail.clients')}</h3>
                {project.isOwner && <InviteClientDialog projectId={project.id} />}
              </div>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('project.detail.noClients')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {clients.map((client) => (
                    <li key={client.id} className="flex items-center justify-between text-sm">
                      <span>{client.name}</span>
                      <span className="text-muted-foreground">{client.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <ProgressCard projectId={project.id} />
        <PendingTasksCard projectId={project.id} />
        <MaterialsCard projectId={project.id} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LaborCard projectId={project.id} />
        {project.isOwner && <BudgetSummaryCard projectId={project.id} currency={project.currency} />}
      </div>
    </div>
  );
}

export default ProjectDetailPage;
