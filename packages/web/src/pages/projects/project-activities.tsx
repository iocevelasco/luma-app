import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { createActivitySchema, type Activity, type CreateActivityInput } from '@luma/shared';
import { AlertTriangle, ChevronLeft, ChevronRight, PackageX, Plus } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fromDayKey } from '@/components/common/date-range-filter';
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
import { currentWeekRange, isActivityOverdue, isSameWeek, isWithinNextDays, shiftWeek } from '@/lib/week';
import { cn } from '@/lib/utils';

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

function ActivityCard({ activity, missingMaterials }: { activity: Activity; missingMaterials: boolean }) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const overdue = isActivityOverdue(activity.endDate, activity.status);

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{activity.name}</p>
            <p className="text-sm text-muted-foreground">{activity.area}</p>
          </div>
          <div className="flex items-center gap-1">
            {missingMaterials && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PackageX className="size-4 text-destructive" aria-label={t('activity.list.missingMaterials')} />
                </TooltipTrigger>
                <TooltipContent>{t('activity.list.missingMaterials')}</TooltipContent>
              </Tooltip>
            )}
            {overdue && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="size-4 text-destructive" aria-label={t('activity.list.overdue')} />
                </TooltipTrigger>
                <TooltipContent>{t('activity.list.overdue')}</TooltipContent>
              </Tooltip>
            )}
            <Badge variant={overdue ? 'destructive' : 'secondary'} className="rounded-full">
              {t(`activity.status.${activity.status}`)}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(fromDayKey(activity.startDate), 'PP', { locale: dateLocale })} –{' '}
          {format(fromDayKey(activity.endDate), 'PP', { locale: dateLocale })}
        </p>
        <p className="text-sm">{t('activity.fields.responsible')}: {activity.responsible.name}</p>
        {activity.notes && <p className="text-sm text-muted-foreground">{activity.notes}</p>}
      </CardContent>
    </Card>
  );
}

export function ProjectActivitiesPage() {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const [range, setRange] = useState(currentWeekRange());

  const { data: activitiesData, isLoading } = useActivities(projectId, range);
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

  if (isLoading || !activitiesData) return <RouteLoading />;

  const isCurrentWeek = isSameWeek(range, currentWeekRange());
  const rangeLabel = `${format(fromDayKey(range.from), 'PP', { locale: dateLocale })} – ${format(
    fromDayKey(range.to),
    'PP',
    { locale: dateLocale },
  )}`;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRange((r) => shiftWeek(r, -1))}
              aria-label={t('activity.list.prevWeek')}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <CardTitle className="text-base">{rangeLabel}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRange((r) => shiftWeek(r, 1))}
              aria-label={t('activity.list.nextWeek')}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={() => setRange(currentWeekRange())}>
                {t('activity.list.currentWeek')}
              </Button>
            )}
            {isOwner && <NewActivityDialog projectId={projectId!} />}
          </div>
        </CardHeader>
        <CardContent>
          {activitiesData.activities.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('activity.emptyState.title')}</p>
              {isOwner && <NewActivityDialog projectId={projectId!} />}
            </div>
          ) : (
            <div className={cn('grid gap-3', 'sm:grid-cols-2')}>
              {activitiesData.activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  missingMaterials={activitiesWithAlert.has(activity.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectActivitiesPage;
