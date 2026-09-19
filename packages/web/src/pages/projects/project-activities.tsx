import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { createActivitySchema, type Activity, type CreateActivityInput } from '@luma/shared';
import { ArrowLeft, PackageX, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ActivityGantt } from '@/components/activities/activity-gantt';
import { DateRangeFilter, fromDayKey, presetRange } from '@/components/common/date-range-filter';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAllActivities, useActivities, useCreateActivity } from '@/hooks/activities/use-activity-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useProject } from '@/hooks/projects/use-project-queries';
import { isActivityOverdue, isWithinNextDays } from '@/lib/week';

const ACTIVITY_STATUSES = ['pendiente', 'en_curso', 'completada', 'cancelada'] as const;

function NewActivityDialog({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createActivity = useCreateActivity(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateActivityInput>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { status: 'pendiente' },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t('activity.list.new')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('activity.list.newTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            createActivity.mutate(values, {
              onSuccess: () => {
                setOpen(false);
                reset();
              },
            }),
          )}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-name">{t('activity.fields.name')}</Label>
            <Input id="activity-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-area">{t('activity.fields.area')}</Label>
            <Input id="activity-area" {...register('area')} />
            {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-start">{t('activity.fields.startDate')}</Label>
              <Input id="activity-start" type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity-end">{t('activity.fields.endDate')}</Label>
              <Input id="activity-end" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-responsible">{t('activity.fields.responsible')}</Label>
            <Input id="activity-responsible" {...register('responsible.name')} />
            {errors.responsible?.name && (
              <p className="text-sm text-destructive">{errors.responsible.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-status">{t('activity.fields.status')}</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="activity-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`activity.status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity-notes">{t('activity.fields.notes')}</Label>
            <Textarea id="activity-notes" rows={3} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? t('common.loading') : t('activity.list.newSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDetailModal({
  activity,
  missingMaterials,
  onClose,
}: {
  activity: Activity | undefined;
  missingMaterials: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <Dialog open={Boolean(activity)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none p-0 sm:max-w-none"
      >
        {activity && (
          <>
            <DialogHeader className="sticky top-0 z-10 flex-row items-center gap-3 space-y-0 border-b border-border bg-background p-4">
              <Button variant="outline" onClick={onClose}>
                <ArrowLeft className="size-4" />
                {t('activity.detail.back')}
              </Button>
              <DialogTitle className="text-base">{t('activity.detail.title')}</DialogTitle>
            </DialogHeader>

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-medium">{activity.name}</p>
                  <p className="text-sm text-muted-foreground">{activity.area}</p>
                </div>
                <div className="flex items-center gap-1">
                  {missingMaterials && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PackageX
                          className="size-4 text-destructive"
                          aria-label={t('activity.list.missingMaterials')}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{t('activity.list.missingMaterials')}</TooltipContent>
                    </Tooltip>
                  )}
                  <Badge
                    variant={isActivityOverdue(activity.endDate, activity.status) ? 'destructive' : 'secondary'}
                  >
                    {t(`activity.status.${activity.status}`)}
                  </Badge>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('activity.fields.startDate')}</dt>
                  <dd>{format(fromDayKey(activity.startDate), 'PP', { locale: dateLocale })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('activity.fields.endDate')}</dt>
                  <dd>{format(fromDayKey(activity.endDate), 'PP', { locale: dateLocale })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('activity.fields.responsible')}</dt>
                  <dd>{activity.responsible.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('activity.fields.status')}</dt>
                  <dd>{t(`activity.status.${activity.status}`)}</dd>
                </div>
              </dl>

              {activity.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">{t('activity.fields.notes')}</p>
                  <p className="text-sm">{activity.notes}</p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProjectActivitiesPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const [range, setRange] = useState<{ from: string; to: string }>(() => presetRange('thisMonth'));
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const rangeInitialized = useRef(false);

  // Rango inicial: el de la obra completa, no "este mes" — una obra planifica
  // meses a futuro y el default no puede empezar mostrando el gantt vacío.
  useEffect(() => {
    if (rangeInitialized.current || !projectData) return;
    rangeInitialized.current = true;
    setRange({
      from: projectData.project.estimatedStartDate,
      to: projectData.project.estimatedEndDate,
    });
  }, [projectData]);

  const { data: activitiesData, isLoading, isError } = useActivities(projectId, range);
  const { data: allActivitiesData } = useAllActivities(projectId);
  const { data: materialsData } = useMaterials(projectId);

  const isOwner = Boolean(projectData?.project.isOwner);

  const missingByActivity = useMemo(() => {
    const map = new Set<string>();
    if (!materialsData) return map;
    for (const material of materialsData.materials) {
      if (!material.activityId) continue;
      if (material.status === 'pendiente' || material.status === 'solicitado') {
        map.add(material.activityId);
      }
    }
    return map;
  }, [materialsData]);

  const activitiesWithAlert = useMemo(() => {
    if (!allActivitiesData) return new Set<string>();
    const result = new Set<string>();
    for (const activity of allActivitiesData.activities) {
      if (isWithinNextDays(activity.startDate, 7) && missingByActivity.has(activity.id)) {
        result.add(activity.id);
      }
    }
    return result;
  }, [allActivitiesData, missingByActivity]);

  if (isError) return <RouteError />;
  if (isLoading || !activitiesData) return <RouteLoading />;

  const selectedActivity = activitiesData.activities.find((a) => a.id === selectedActivityId);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col gap-3 p-3 md:p-4">
      <Card className="min-h-0 min-w-0 flex-1">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-base">{t('project.detail.gantt')}</CardTitle>
          <div className="flex items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} disableFuture={false} />
            {isOwner && <NewActivityDialog projectId={projectId!} />}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activitiesData.activities.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('activity.gantt.emptyState')}</p>
            </div>
          ) : (
            <ActivityGantt
              activities={activitiesData.activities}
              range={range}
              onSelectActivity={setSelectedActivityId}
              missingMaterialActivityIds={activitiesWithAlert}
            />
          )}
        </CardContent>
      </Card>

      <ActivityDetailModal
        activity={selectedActivity}
        missingMaterials={Boolean(selectedActivityId && activitiesWithAlert.has(selectedActivityId))}
        onClose={() => setSelectedActivityId(null)}
      />
    </div>
  );
}

export default ProjectActivitiesPage;
