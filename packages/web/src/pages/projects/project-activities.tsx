import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  createActivitySchema,
  type Activity,
  type CreateActivityInput,
  type MaterialItem,
} from '@luma/shared';
import { ArrowLeft, PackageX, Pencil, Plus } from 'lucide-react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ActivityGantt } from '@/components/activities/activity-gantt';
import { DateRangeFilter, fromDayKey, presetRange } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useAllActivities, useActivities, useCreateActivity, useUpdateActivity } from '@/hooks/activities/use-activity-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useProject } from '@/hooks/projects/use-project-queries';
import { isActivityOverdue, isWithinNextDays } from '@/lib/week';

const ACTIVITY_STATUSES = ['pendiente', 'en_curso', 'completada', 'cancelada'] as const;
const MATERIAL_STATUSES_BLOCKING = new Set(['pendiente', 'solicitado']);

/**
 * Campos del formulario de actividad, compartidos entre "Nueva actividad" y
 * "Editar actividad" — son el mismo form, sólo cambia qué mutación dispara.
 */
function ActivityFormFields({
  idPrefix,
  register,
  control,
  errors,
}: {
  idPrefix: string;
  register: UseFormRegister<CreateActivityInput>;
  control: Control<CreateActivityInput>;
  errors: FieldErrors<CreateActivityInput>;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('activity.fields.name')}</Label>
        <Input id={`${idPrefix}-name`} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-area`}>{t('activity.fields.area')}</Label>
        <Input id={`${idPrefix}-area`} {...register('area')} />
        {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-start`}>{t('activity.fields.startDate')}</Label>
          <Input id={`${idPrefix}-start`} type="date" {...register('startDate')} />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-end`}>{t('activity.fields.endDate')}</Label>
          <Input id={`${idPrefix}-end`} type="date" {...register('endDate')} />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-responsible`}>{t('activity.fields.responsible')}</Label>
        <Input id={`${idPrefix}-responsible`} {...register('responsible.name')} />
        {errors.responsible?.name && (
          <p className="text-sm text-destructive">{errors.responsible.name.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-status`}>{t('activity.fields.status')}</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-status`}>
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
        <Label htmlFor={`${idPrefix}-notes`}>{t('activity.fields.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} rows={3} {...register('notes')} />
      </div>
    </>
  );
}

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
          <ActivityFormFields idPrefix="activity" register={register} control={control} errors={errors} />
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

function EditActivityDialog({
  projectId,
  activity,
  open,
  onOpenChange,
}: {
  projectId: string;
  activity: Activity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const updateActivity = useUpdateActivity(projectId);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateActivityInput>({
    resolver: zodResolver(createActivitySchema),
    values: {
      name: activity.name,
      area: activity.area,
      startDate: activity.startDate,
      endDate: activity.endDate,
      responsible: activity.responsible,
      status: activity.status,
      notes: activity.notes,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('activity.detail.editTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            updateActivity.mutate(
              { activityId: activity.id, payload: values },
              { onSuccess: () => onOpenChange(false) },
            ),
          )}
        >
          <ActivityFormFields idPrefix="edit-activity" register={register} control={control} errors={errors} />
          <DialogFooter>
            <Button type="submit" disabled={updateActivity.isPending}>
              {updateActivity.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivityMaterialsList({ materials }: { materials: MaterialItem[] }) {
  const { t } = useTranslation();

  if (materials.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('activity.detail.noMaterials')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {materials.map((material) => (
        <li key={material.id} className="flex items-center justify-between gap-2 text-sm">
          <span>
            {material.name} — {material.quantity} {t(`material.unit.${material.unit}`)}
          </span>
          <Badge variant={MATERIAL_STATUSES_BLOCKING.has(material.status) ? 'destructive' : 'secondary'}>
            {t(`material.status.${material.status}`)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function ActivityDetailModal({
  projectId,
  activity,
  materials,
  missingMaterials,
  isOwner,
  onClose,
}: {
  projectId: string;
  activity: Activity | undefined;
  materials: MaterialItem[];
  missingMaterials: boolean;
  isOwner: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [editing, setEditing] = useState(false);

  return (
    <Dialog open={Boolean(activity)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none p-0 sm:max-w-none"
      >
        {activity && (
          <>
            <DialogHeader className="sticky top-0 z-10 flex-row items-center justify-between gap-3 space-y-0 border-b border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onClose}>
                  <ArrowLeft className="size-4" />
                  {t('activity.detail.back')}
                </Button>
                <DialogTitle className="text-base text-muted-foreground">
                  {t('activity.detail.title')}
                </DialogTitle>
              </div>
              {isOwner && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />
                  {t('activity.detail.edit')}
                </Button>
              )}
            </DialogHeader>

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl">{activity.name}</h2>
                  <p className="text-muted-foreground">{activity.area}</p>
                </div>
                <div className="flex items-center gap-2">
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

              <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted-foreground">{t('activity.fields.startDate')}</dt>
                  <dd className="mt-1">{format(fromDayKey(activity.startDate), 'PP', { locale: dateLocale })}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('activity.fields.endDate')}</dt>
                  <dd className="mt-1">{format(fromDayKey(activity.endDate), 'PP', { locale: dateLocale })}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('activity.fields.responsible')}</dt>
                  <dd className="mt-1">{activity.responsible.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('activity.fields.status')}</dt>
                  <dd className="mt-1">{t(`activity.status.${activity.status}`)}</dd>
                </div>
              </dl>

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h3 className="text-sm font-medium">{t('activity.detail.materials')}</h3>
                <ActivityMaterialsList materials={materials} />
              </div>

              {activity.notes && (
                <div className="flex flex-col gap-2 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">{t('activity.detail.notes')}</h3>
                  <p className="text-sm text-muted-foreground">{activity.notes}</p>
                </div>
              )}
            </div>

            {isOwner && (
              <EditActivityDialog
                projectId={projectId}
                activity={activity}
                open={editing}
                onOpenChange={setEditing}
              />
            )}
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
      if (MATERIAL_STATUSES_BLOCKING.has(material.status)) {
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
  const selectedActivityMaterials = selectedActivity
    ? (materialsData?.materials ?? []).filter((m) => m.activityId === selectedActivity.id)
    : [];

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangeFilter value={range} onChange={setRange} disableFuture={false} />
        {isOwner && <NewActivityDialog projectId={projectId!} />}
      </div>

      <div className="min-h-0 min-w-0 flex-1">
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
      </div>

      <ActivityDetailModal
        projectId={projectId!}
        activity={selectedActivity}
        materials={selectedActivityMaterials}
        missingMaterials={Boolean(selectedActivityId && activitiesWithAlert.has(selectedActivityId))}
        isOwner={isOwner}
        onClose={() => setSelectedActivityId(null)}
      />
    </div>
  );
}

export default ProjectActivitiesPage;
