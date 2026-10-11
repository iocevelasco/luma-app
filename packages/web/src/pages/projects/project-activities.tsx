import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  createActivitySchema,
  type Activity,
  type CreateActivityInput,
  type MaterialItem,
  type ProviderSpecialty,
} from '@luma/shared';
import { ArrowLeft, Camera, Check, PackageX, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ActivityGantt } from '@/components/activities/activity-gantt';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { DateRangeFilter, fromDayKey, presetRange } from '@/components/common/date-range-filter';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormDrawer } from '@/components/common/form-drawer';
// El detalle de la actividad sigue siendo un Dialog a pantalla completa: es
// una vista de lectura, no un formulario.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import {
  useAllActivities,
  useActivities,
  useCreateActivity,
  useDeleteActivityEvidence,
  useRejectActivity,
  useUpdateActivity,
  useUploadActivityEvidence,
} from '@/hooks/activities/use-activity-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import {
  useActivityProviders,
  useAssignProvider,
  useProviders,
  useUnassignProvider,
} from '@/hooks/providers/use-provider-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useProject } from '@/hooks/projects/use-project-queries';
import { isWithinNextDays } from '@/lib/week';

const ACTIVITY_STATUSES = [
  'pendiente',
  'en_curso',
  'en_revision',
  'completada',
  'cancelada',
] as const;

/** Mismo catálogo que proveedores y personal (test de sincronía en `@luma/shared`). */
const ACTIVITY_SPECIALTIES: ProviderSpecialty[] = [
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'cristaleria',
  'albanileria',
  'herreria',
  'redes',
  'mecanicas',
  'estructura',
  'acabados',
  'pintura',
  'climatizacion',
  'techos',
  'pisos_revestimientos',
  'jardineria',
  'demolicion',
  'otra',
];
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
  isOwner = false,
}: {
  idPrefix: string;
  register: UseFormRegister<CreateActivityInput>;
  control: Control<CreateActivityInput>;
  errors: FieldErrors<CreateActivityInput>;
  /** Cerrar es del supervisor: al resto ni se le ofrece "Completada". */
  isOwner?: boolean;
}) {
  const { t } = useTranslation();
  const statuses = isOwner
    ? ACTIVITY_STATUSES
    : ACTIVITY_STATUSES.filter((status) => status !== 'completada');

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
                {statuses.map((status) => (
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
        <Label htmlFor={`${idPrefix}-specialty`}>{t('activity.fields.specialty')}</Label>
        <Controller
          control={control}
          name="specialty"
          render={({ field }) => (
            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-specialty`}>
                <SelectValue placeholder={t('activity.fields.specialtyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_SPECIALTIES.map((specialty) => (
                  <SelectItem key={specialty} value={specialty}>
                    {t(`provider.specialty.${specialty}`)}
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

function NewActivityDialog({ projectId, isOwner }: { projectId: string; isOwner: boolean }) {
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
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('activity.list.new')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={t('activity.list.newTitle')}
        fieldCount={8}
        submitLabel={t('activity.list.newSubmit')}
        isSubmitting={createActivity.isPending}
        onSubmit={handleSubmit((values) =>
          createActivity.mutate(values, {
            onSuccess: () => {
              setOpen(false);
              reset();
            },
          }),
        )}
      >
        <ActivityFormFields
          idPrefix="activity"
          register={register}
          control={control}
          errors={errors}
          isOwner={isOwner}
        />
      </FormDrawer>
    </>
  );
}

function EditActivityDialog({
  projectId,
  activity,
  isOwner,
  open,
  onOpenChange,
}: {
  projectId: string;
  activity: Activity;
  isOwner: boolean;
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
      specialty: activity.specialty,
      notes: activity.notes,
    },
  });

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('activity.detail.editTitle')}
      fieldCount={8}
      isSubmitting={updateActivity.isPending}
      onSubmit={handleSubmit((values) =>
        updateActivity.mutate(
          { activityId: activity.id, payload: values },
          { onSuccess: () => onOpenChange(false) },
        ),
      )}
    >
      <ActivityFormFields
        idPrefix="edit-activity"
        register={register}
        control={control}
        errors={errors}
        isOwner={isOwner}
      />
    </FormDrawer>
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

/**
 * El paso de validación: quien hizo el trabajo lo reporta (`en_revision`) y
 * el supervisor cierra o lo devuelve con motivo. El motivo sobrevive al
 * rechazo y queda visible mientras la actividad está `en_curso` — es lo que
 * tiene que leer quien vuelve a corregirla.
 */
function ActivityReviewSection({
  projectId,
  activity,
  isOwner,
}: {
  projectId: string;
  activity: Activity;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const updateActivity = useUpdateActivity(projectId);
  const rejectActivity = useRejectActivity(projectId);

  const rejection = activity.review?.rejectionReason;
  const showRejection = Boolean(rejection) && activity.status !== 'en_revision';

  if (activity.status !== 'en_revision' && !showRejection) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-medium">{t('activity.review.title')}</h3>

      {showRejection && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive">
            {t('activity.review.returnedTitle')}
          </p>
          <p className="text-sm">{rejection}</p>
        </div>
      )}

      {activity.status === 'en_revision' &&
        (isOwner ? (
          rejecting ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reject-reason">{t('activity.review.reasonLabel')}</Label>
              <Textarea
                id="reject-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('activity.review.reasonPlaceholder')}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={!reason.trim() || rejectActivity.isPending}
                  onClick={() =>
                    rejectActivity.mutate(
                      { activityId: activity.id, reason: reason.trim() },
                      {
                        onSuccess: () => {
                          setReason('');
                          setRejecting(false);
                        },
                      },
                    )
                  }
                >
                  {t('activity.review.confirmReturn')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setRejecting(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={updateActivity.isPending}
                onClick={() =>
                  updateActivity.mutate({
                    activityId: activity.id,
                    payload: { status: 'completada' },
                  })
                }
              >
                <Check className="size-4" />
                {t('activity.review.approve')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRejecting(true)}>
                <Undo2 className="size-4" />
                {t('activity.review.return')}
              </Button>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t('activity.review.waiting')}</p>
        ))}
    </div>
  );
}

/**
 * Proveedores asignados a la actividad — directorio de la Empresa (no de la
 * obra), ver RF nuevo. Dueño y Asistente de Obra asignan/desasignan por
 * igual; el cliente ni siquiera ve esta sección (se oculta desde el tab de
 * navegación — ver `project-tabs.tsx`).
 */
function ActivityProvidersSection({
  projectId,
  activityId,
  isEditor,
  canRead,
}: {
  projectId: string;
  activityId: string;
  isEditor: boolean;
  /** Dueño/Asistente siempre; el cliente sólo si la obra lo habilitó. */
  canRead: boolean;
}) {
  const { t } = useTranslation();
  const [selectedProviderId, setSelectedProviderId] = useState('');
  // Sin permiso de lectura no se piden los endpoints: para ese rol son 403.
  const { data: assignedData } = useActivityProviders(
    canRead ? projectId : undefined,
    canRead ? activityId : undefined,
  );
  // El directorio completo sólo lo necesita quien puede asignar.
  const { data: directoryData } = useProviders(isEditor ? projectId : undefined);
  const assignProvider = useAssignProvider(projectId, activityId);
  const unassignProvider = useUnassignProvider(projectId, activityId);

  if (!canRead) return null;

  const assigned = assignedData?.providers ?? [];
  const assignedIds = new Set(assigned.map((provider) => provider.id));
  const available = (directoryData?.providers ?? []).filter(
    (provider) => !assignedIds.has(provider.id),
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h3 className="text-sm font-medium">{t('activity.detail.providers')}</h3>

      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('activity.detail.noProviders')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assigned.map((provider) => (
            <li
              key={provider.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm"
            >
              <span>{provider.name}</span>
              <span className="text-muted-foreground">
                · {provider.specialty === 'otra' ? provider.customSpecialty : t(`provider.specialty.${provider.specialty}`)}
              </span>
              {isEditor && (
                <button
                  type="button"
                  onClick={() => unassignProvider.mutate(provider.id)}
                  aria-label={t('activity.detail.unassignProvider')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isEditor && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('activity.detail.assignProviderPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {available.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectedProviderId || assignProvider.isPending}
            onClick={() => {
              assignProvider.mutate(
                { providerId: selectedProviderId },
                { onSuccess: () => setSelectedProviderId('') },
              );
            }}
          >
            <Plus className="size-4" />
            {t('activity.detail.assignProvider')}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Registro fotográfico de avance (RF-04), opcional. Si el storage no está
 * configurado en el server, subir da 503 — el toast de error ya lo explica,
 * no hace falta un estado especial acá.
 */
function ActivityEvidenceSection({
  projectId,
  activity,
  isEditor,
}: {
  projectId: string;
  activity: Activity;
  isEditor: boolean;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadEvidence = useUploadActivityEvidence(projectId, activity.id);
  const deleteEvidence = useDeleteActivityEvidence(projectId, activity.id);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de un error.
    event.target.value = '';
    if (file) uploadEvidence.mutate(file);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium">{t('activity.detail.evidence')}</h3>
        {isEditor && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadEvidence.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4" />
              {t('activity.detail.addEvidence')}
            </Button>
          </>
        )}
      </div>

      {activity.evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('activity.detail.noEvidence')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activity.evidence.map((photo) => (
            <li
              key={photo.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
              {isEditor && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => deleteEvidence.mutate(photo.id)}
                  aria-label={t('activity.detail.removeEvidence')}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityDetailModal({
  projectId,
  activity,
  materials,
  missingMaterials,
  isEditor,
  isOwner,
  canReadProviders,
  onClose,
}: {
  projectId: string;
  activity: Activity | undefined;
  materials: MaterialItem[];
  missingMaterials: boolean;
  isEditor: boolean;
  isOwner: boolean;
  canReadProviders: boolean;
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
              {isEditor && (
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
                  <p className="text-muted-foreground">
                    {activity.area}
                    {activity.specialty
                      ? ` · ${t(`provider.specialty.${activity.specialty}`)}`
                      : ''}
                  </p>
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
                  <ActivityStatusBadge status={activity.status} endDate={activity.endDate} />
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

              <ActivityReviewSection
                projectId={projectId}
                activity={activity}
                isOwner={isOwner}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h3 className="text-sm font-medium">{t('activity.detail.materials')}</h3>
                <ActivityMaterialsList materials={materials} />
              </div>

              <ActivityProvidersSection
                projectId={projectId}
                activityId={activity.id}
                isEditor={isEditor}
                canRead={canReadProviders}
              />

              <ActivityEvidenceSection projectId={projectId} activity={activity} isEditor={isEditor} />

              {activity.notes && (
                <div className="flex flex-col gap-2 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">{t('activity.detail.notes')}</h3>
                  <p className="text-sm text-muted-foreground">{activity.notes}</p>
                </div>
              )}
            </div>

            {isEditor && (
              <EditActivityDialog
                projectId={projectId}
                activity={activity}
                isOwner={isOwner}
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

  const isEditor = Boolean(projectData?.project.isEditor);
  const canReadProviders = isEditor || Boolean(projectData?.project.providersVisibleToClient);

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
        {isEditor && (
          <NewActivityDialog
            projectId={projectId!}
            isOwner={Boolean(projectData?.project.isOwner)}
          />
        )}
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
        isEditor={isEditor}
        isOwner={Boolean(projectData?.project.isOwner)}
        canReadProviders={canReadProviders}
        onClose={() => setSelectedActivityId(null)}
      />
    </div>
  );
}

export default ProjectActivitiesPage;
