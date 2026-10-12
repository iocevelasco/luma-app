import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMilestoneSchema,
  MILESTONE_SEVERITIES,
  MILESTONE_TYPES,
  type CreateMilestoneInput,
  type Milestone,
  type MilestoneSeverity,
} from '@luma/shared';
import { format } from 'date-fns';
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { Fab } from '@/components/common/fab';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { FormDrawer } from '@/components/common/form-drawer';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
} from '@/hooks/milestones/use-milestone-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { cn } from '@/lib/utils';

/**
 * El color del badge de gravedad. `destructive` es peligro y no marca — ver
 * DESIGN.md: desde el sistema único, el rojo significa problema.
 */
const SEVERITY_VARIANT: Record<MilestoneSeverity, 'secondary' | 'default' | 'destructive'> = {
  info: 'secondary',
  atencion: 'default',
  critico: 'destructive',
};

function NewMilestoneDrawer({ projectId, canPublish }: { projectId: string; canPublish: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createMilestone = useCreateMilestone(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: {
      // El supervisor sólo puede reportar hacia adentro, así que su único
      // valor posible ya viene puesto y el campo no se le muestra.
      audience: canPublish ? undefined : 'interno',
      severity: 'info',
      occurredOn: toDayKey(new Date()),
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('milestone.new.title')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={t('milestone.new.title')}
        fieldCount={canPublish ? 6 : 5}
        submitLabel={t('milestone.new.submit')}
        isSubmitting={createMilestone.isPending}
        error={createMilestone.error}
        onSubmit={handleSubmit((values) =>
          createMilestone.mutate(values, {
            onSuccess: () => {
              reset();
              setOpen(false);
            },
          }),
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-type">{t('milestone.fields.type')}</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="milestone-type">
                  <SelectValue placeholder={t('milestone.fields.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`milestone.type.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-title">{t('milestone.fields.title')}</Label>
          <Input id="milestone-title" {...register('title')} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-date">{t('milestone.fields.occurredOn')}</Label>
          <Input id="milestone-date" type="date" {...register('occurredOn')} />
          {errors.occurredOn && (
            <p className="text-sm text-destructive">{errors.occurredOn.message}</p>
          )}
        </div>

        {/*
          La audiencia sólo se elige si se puede publicar. Al supervisor no se
          le muestra un campo con una única opción: eso sugiere que hay otra
          que le están negando.
        */}
        {canPublish && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('milestone.fields.audience')}</legend>
            <Controller
              control={control}
              name="audience"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  {(['cliente', 'interno'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => field.onChange(option)}
                      aria-pressed={field.value === option}
                      className={cn(
                        'flex items-start gap-2 rounded-md border p-3 text-left transition-colors',
                        field.value === option
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      {option === 'cliente' ? (
                        <Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <EyeOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {t(`milestone.audience.${option}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(`milestone.audienceHint.${option}`)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            />
            {errors.audience && (
              <p className="text-sm text-destructive">{errors.audience.message}</p>
            )}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-severity">{t('milestone.fields.severity')}</Label>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="milestone-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_SEVERITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`milestone.severity.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-activity">{t('milestone.fields.activity')}</Label>
          <Controller
            control={control}
            name="activityId"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="milestone-activity">
                  <SelectValue placeholder={t('milestone.fields.activityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(activitiesData?.activities ?? []).map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-description">{t('milestone.fields.description')}</Label>
          <Textarea id="milestone-description" rows={3} {...register('description')} />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>
      </FormDrawer>
    </>
  );
}

function DeleteMilestoneButton({
  projectId,
  milestone,
}: {
  projectId: string;
  milestone: Milestone;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const deleteMilestone = useDeleteMilestone(projectId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t('milestone.delete.action')}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('milestone.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('milestone.delete.description', { title: milestone.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMilestone.mutate(milestone.id, { onSuccess: () => setOpen(false) })
              }
            >
              {t('milestone.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MilestoneRow({
  projectId,
  milestone,
  canReport,
}: {
  projectId: string;
  milestone: Milestone;
  canReport: boolean;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{milestone.title}</p>
          <Badge variant={SEVERITY_VARIANT[milestone.severity]}>
            {t(`milestone.severity.${milestone.severity}`)}
          </Badge>
          {/*
            Marcar lo interno y no lo público: lo normal es que un hito sea
            para el cliente, y etiquetar cada fila con "cliente" sería ruido.
            Lo que hay que poder ver de un vistazo es qué NO salió de adentro.
          */}
          {milestone.audience === 'interno' && (
            <Badge variant="outline" className="gap-1">
              <EyeOff className="size-3" />
              {t('milestone.audience.interno')}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t(`milestone.type.${milestone.type}`)}
          {milestone.activityName && ` · ${milestone.activityName}`}
        </p>

        {milestone.description && <p className="text-sm">{milestone.description}</p>}

        <p className="text-2xs text-muted-foreground">
          {t('milestone.reportedBy', {
            name: milestone.reportedByName,
            date: format(fromDayKey(milestone.occurredOn), 'PP', { locale: dateLocale }),
          })}
        </p>
      </div>

      {canReport && <DeleteMilestoneButton projectId={projectId} milestone={milestone} />}
    </li>
  );
}

export function ProjectMilestonesPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useMilestones(projectId);
  const { can } = useProjectCapabilities(projectId);

  const canReport = can('milestone.report');
  const canPublish = can('milestone.publish');

  if (isError) return <RouteError />;
  if (isLoading || !data) return <RouteLoading />;

  if (data.milestones.length === 0) {
    return (
      <div className="p-3 md:p-4">
        <EmptyState
          variant="notifications"
          title={t('milestone.empty.title')}
          description={
            canReport ? t('milestone.empty.description') : t('milestone.empty.descriptionReadOnly')
          }
          action={
            canReport ? (
              <NewMilestoneDrawer projectId={projectId!} canPublish={canPublish} />
            ) : undefined
          }
          replacesPrimaryAction
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-3 md:p-4">
      {canReport && (
        <Fab>
          <NewMilestoneDrawer projectId={projectId!} canPublish={canPublish} />
        </Fab>
      )}

      {/* Cronología: lo último arriba. La API ya ordena por `occurredOn` desc. */}
      <ul className="flex flex-col gap-2">
        {data.milestones.map((milestone) => (
          <MilestoneRow
            key={milestone.id}
            projectId={projectId!}
            milestone={milestone}
            canReport={canReport}
          />
        ))}
      </ul>
    </div>
  );
}

export default ProjectMilestonesPage;
