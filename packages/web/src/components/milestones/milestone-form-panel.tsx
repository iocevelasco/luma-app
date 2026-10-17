import { lazy, Suspense, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMilestoneSchema,
  MILESTONE_ATTENDEES_MAX,
  MILESTONE_SEVERITIES,
  MILESTONE_TYPES,
  type CreateMilestoneInput,
  type Milestone,
} from '@luma/shared';
import { Eye, EyeOff, X } from 'lucide-react';
import { Controller, useForm, type Control, type DefaultValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FormPanel } from '@/components/common/form-panel';
import {
  MilestoneAttachmentsField,
  type LocalAttachment,
} from '@/components/milestones/milestone-attachments-field';
import { toDayKey } from '@/components/common/date-range-filter';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateMilestone,
  useMilestones,
  useUpdateMilestone,
  useUploadMilestoneAttachment,
} from '@/hooks/milestones/use-milestone-queries';
import { errorMessage } from '@/lib/error-message';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { projectMilestoneEditPath, projectMilestonesPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

// Tiptap y ProseMirror sólo se bajan cuando se abre el formulario.
const MarkdownEditor = lazy(() =>
  import('@/components/markdown/markdown-editor').then((m) => ({ default: m.MarkdownEditor })),
);

/**
 * Alta y edición de un hito, en `FormPanel`. Las dos son rutas
 * (`hitos/nuevo`, `hitos/:id/editar`) que se montan sobre el listado.
 *
 * Los permisos se vuelven a mirar acá y no sólo en el botón que trae hasta
 * esta pantalla: con una ruta, cualquiera puede escribir la URL a mano. Quien
 * no puede editar vuelve al listado, sin un formulario que terminaría en 403.
 */
export function MilestoneNewPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const { can, isLoading } = useProjectCapabilities(projectId);

  if (isLoading) return null;
  if (!can('milestone.report')) return <Navigate to={projectMilestonesPath(projectId!)} replace />;

  return <MilestoneForm projectId={projectId!} canPublish={can('milestone.publish')} />;
}

export function MilestoneEditPanel() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const { can, isLoading } = useProjectCapabilities(projectId);
  const { data } = useMilestones(projectId);

  if (isLoading || !data) return null;

  const milestone = data.milestones.find((item) => item.id === milestoneId);
  const canPublish = can('milestone.publish');
  // Mismo criterio que la API: un hito publicado al cliente sólo lo edita
  // quien puede publicar.
  const canEdit =
    milestone && can('milestone.report') && (milestone.audience === 'interno' || canPublish);

  if (!canEdit) return <Navigate to={projectMilestonesPath(projectId!)} replace />;

  return <MilestoneForm projectId={projectId!} canPublish={canPublish} milestone={milestone} />;
}

function valuesFrom(
  milestone: Milestone | undefined,
  canPublish: boolean,
): DefaultValues<CreateMilestoneInput> {
  if (!milestone) {
    return {
      // El supervisor sólo puede reportar hacia adentro, así que su único
      // valor posible ya viene puesto y el campo no se le muestra.
      audience: canPublish ? undefined : 'interno',
      severity: 'info',
      occurredOn: toDayKey(new Date()),
      description: '',
      attendees: [],
    };
  }

  return {
    type: milestone.type,
    audience: milestone.audience,
    severity: milestone.severity,
    title: milestone.title,
    occurredOn: milestone.occurredOn,
    activityId: milestone.activityId,
    description: milestone.description ?? '',
    attendees: milestone.attendees ?? [],
  };
}

function MilestoneForm({
  projectId,
  canPublish,
  milestone,
}: {
  projectId: string;
  canPublish: boolean;
  milestone?: Milestone;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMilestone = useCreateMilestone(projectId);
  const updateMilestone = useUpdateMilestone(projectId);
  const { data: activitiesData } = useAllActivities(projectId);
  const uploadAttachment = useUploadMilestoneAttachment(projectId);
  const location = useLocation();
  const isEdit = Boolean(milestone);
  const mutation = isEdit ? updateMilestone : createMilestone;

  // En el alta el hito no existe todavía: los archivos esperan al guardado.
  const [pendingFiles, setPendingFiles] = useState<LocalAttachment[]>([]);
  const [uploadingAfterCreate, setUploadingAfterCreate] = useState(false);
  const failedAfterCreate = (
    location.state as { failedUploads?: { name: string; message: string }[] } | null
  )?.failedUploads;

  /**
   * Después del alta, de a uno. Si alguno falla el hito ya existe: se abre su
   * edición diciendo cuáles no subieron, en vez de perderlos en silencio o de
   * deshacer un hito que sí se guardó.
   */
  const uploadPending = async (milestoneId: string) => {
    const failedUploads: { name: string; message: string }[] = [];
    setUploadingAfterCreate(true);
    for (const item of pendingFiles.filter((entry) => entry.status === 'pending')) {
      try {
        await uploadAttachment.mutateAsync({ milestoneId, file: item.file });
      } catch (error) {
        failedUploads.push({
          name: item.file.name,
          message: errorMessage(error, t) ?? t('milestone.attachments.errors.upload'),
        });
      }
    }
    setUploadingAfterCreate(false);

    if (failedUploads.length > 0) {
      navigate(projectMilestoneEditPath(projectId, milestoneId), {
        replace: true,
        state: { failedUploads },
      });
    } else {
      close();
    }
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: valuesFrom(milestone, canPublish),
  });

  const type = watch('type');
  const close = () => navigate(projectMilestonesPath(projectId));

  const submit = handleSubmit((values) => {
    // Los asistentes sólo viajan en una reunión. Al cambiar de tipo ya se
    // vaciaron, pero el payload no depende de eso.
    const payload = {
      ...values,
      attendees: values.type === 'reunion' ? (values.attendees ?? []) : undefined,
    };

    if (milestone) {
      updateMilestone.mutate({ milestoneId: milestone.id, ...payload }, { onSuccess: close });
    } else {
      createMilestone.mutate(payload, {
        onSuccess: ({ milestone: created }) => void uploadPending(created.id),
      });
    }
  });

  return (
    <FormPanel
      title={isEdit ? t('milestone.edit.title') : t('milestone.new.title')}
      onClose={close}
      onSubmit={submit}
      submitLabel={isEdit ? t('milestone.edit.submit') : t('milestone.new.submit')}
      isSubmitting={mutation.isPending || uploadingAfterCreate}
      isDirty={isEdit ? isDirty : undefined}
      hasUnsavedChanges={
        (isDirty || pendingFiles.some((item) => item.status === 'pending')) && !mutation.isSuccess
      }
      error={mutation.error}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-type">{t('milestone.fields.type')}</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  // Sólo una reunión lleva asistentes: si deja de serlo, se van.
                  if (next !== 'reunion') setValue('attendees', [], { shouldDirty: true });
                }}
              >
                <SelectTrigger
                  aria-invalid={Boolean(errors.type)}
                  id="milestone-type"
                  className="w-full"
                >
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
          <Label htmlFor="milestone-date">{t('milestone.fields.occurredOn')}</Label>
          <Input
            aria-invalid={Boolean(errors.occurredOn)}
            id="milestone-date"
            type="date"
            {...register('occurredOn')}
          />
          {errors.occurredOn && (
            <p className="text-sm text-destructive">{errors.occurredOn.message}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="milestone-title">{t('milestone.fields.title')}</Label>
        <Input aria-invalid={Boolean(errors.title)} id="milestone-title" {...register('title')} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      {type === 'reunion' && <AttendeesField control={control} />}

      {/*
        La audiencia sólo se elige si se puede publicar. Al supervisor no se
        le muestra un campo con una única opción: eso sugiere que hay otra
        que le están negando.
      */}
      {canPublish && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('milestone.fields.audience')}</legend>
          <Controller
            control={control}
            name="audience"
            render={({ field }) => (
              <div className="grid gap-2 md:grid-cols-2">
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
          {errors.audience && <p className="text-sm text-destructive">{errors.audience.message}</p>}
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="milestone-severity">{t('milestone.fields.severity')}</Label>
          <Controller
            control={control}
            name="severity"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="milestone-severity" className="w-full">
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
                <SelectTrigger id="milestone-activity" className="w-full">
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
      </div>

      <div className="flex flex-col gap-2">
        <Label id="milestone-description-label" htmlFor="milestone-description">
          {type === 'reunion' ? t('milestone.fields.minutes') : t('milestone.fields.description')}
        </Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Suspense fallback={<Skeleton className="h-56 w-full rounded-sm md:h-72" />}>
              <MarkdownEditor
                id="milestone-description"
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={
                  type === 'reunion'
                    ? t('milestone.fields.minutesPlaceholder')
                    : t('milestone.fields.descriptionPlaceholder')
                }
                invalid={Boolean(errors.description)}
                labelledBy="milestone-description-label"
                describedBy={errors.description ? 'milestone-description-error' : undefined}
              />
            </Suspense>
          )}
        />
        {errors.description && (
          <p id="milestone-description-error" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {milestone ? (
        <MilestoneAttachmentsField
          mode="live"
          projectId={projectId}
          milestone={milestone}
          initialFailures={failedAfterCreate}
        />
      ) : (
        <MilestoneAttachmentsField
          mode="pending"
          files={pendingFiles}
          onFilesChange={setPendingFiles}
        />
      )}
    </FormPanel>
  );
}

/**
 * Asistentes por nombre: se escribe y Enter (o coma) lo suma. Sin
 * autocompletar contra los usuarios de la obra a propósito: en una reunión hay
 * gente sin cuenta, y la lista guarda nombres, no referencias.
 */
function AttendeesField({ control }: { control: Control<CreateMilestoneInput> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  return (
    <Controller
      control={control}
      name="attendees"
      render={({ field, fieldState }) => {
        const attendees = field.value ?? [];
        const full = attendees.length >= MILESTONE_ATTENDEES_MAX;

        const add = () => {
          const name = draft.trim();
          setDraft('');
          if (!name || full) return;
          // Repetido no suma: es la misma persona.
          if (attendees.some((item) => item.toLowerCase() === name.toLowerCase())) return;
          field.onChange([...attendees, name]);
        };

        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor="milestone-attendees">{t('milestone.fields.attendees')}</Label>
            {attendees.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('milestone.fields.attendees')}>
                {attendees.map((name) => (
                  <li key={name}>
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {name}
                      <button
                        type="button"
                        onClick={() => field.onChange(attendees.filter((item) => item !== name))}
                        aria-label={t('milestone.attendees.remove', { name })}
                        className="rounded-xs p-0.5 hover:bg-background/40"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Input
              id="milestone-attendees"
              aria-invalid={Boolean(fieldState.error)}
              value={draft}
              disabled={full}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  add();
                }
              }}
              onBlur={add}
              placeholder={
                full ? t('milestone.attendees.full') : t('milestone.attendees.placeholder')
              }
            />
            {fieldState.error && (
              <p className="text-sm text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
