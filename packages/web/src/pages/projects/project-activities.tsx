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
import { ArrowLeft, CalendarRange, Camera, Check, PackageX, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { ResponsibleField } from '@/components/activities/responsible-field';
import { SpecialtyLabel } from '@/components/activities/specialty-label';
import { ActivityGantt } from '@/components/activities/activity-gantt';
import { ActivityStatusFilter } from '@/components/activities/activity-status-filter';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import {
  DateRangeFilter,
  fromDayKey,
  presetRange,
  toDayKey,
} from '@/components/common/date-range-filter';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { PageLayout } from '@/components/layout/page-layout';
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
import { Button, buttonVariants } from '@/components/ui/button';
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
import { useAssignableCrew } from '@/hooks/crew/use-crew-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useProject } from '@/hooks/projects/use-project-queries';
import { scheduleRange } from '@/lib/activity-range';
import { parseStatusFilter, serializeStatusFilter } from '@/lib/activity-status-filter';
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
  projectId,
  register,
  control,
  errors,
  canReview = false,
  canCancel = false,
}: {
  idPrefix: string;
  projectId: string;
  register: UseFormRegister<CreateActivityInput>;
  control: Control<CreateActivityInput>;
  errors: FieldErrors<CreateActivityInput>;
  /** Cerrar es del gerente (`activity.review`): al resto ni se le ofrece "Completada". */
  canReview?: boolean;
  /** Cancelar es modificar (`activity.plan`): el supervisor crea, pero no cancela. */
  canCancel?: boolean;
}) {
  const { t } = useTranslation();
  const statuses = ACTIVITY_STATUSES.filter(
    (status) => (status !== 'completada' || canReview) && (status !== 'cancelada' || canCancel),
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('activity.fields.name')}</Label>
        <Input aria-invalid={Boolean(errors.name)} id={`${idPrefix}-name`} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-specialty`}>{t('activity.fields.specialty')}</Label>
        <Controller
          control={control}
          name="specialty"
          render={({ field }) => (
            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
              <SelectTrigger aria-invalid={Boolean(errors.specialty)} id={`${idPrefix}-specialty`}>
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
        {errors.specialty && (
          <p className="text-sm text-destructive">{t('activity.fields.specialtyRequired')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-start`}>{t('activity.fields.startDate')}</Label>
          <Input aria-invalid={Boolean(errors.startDate)} id={`${idPrefix}-start`} type="date" {...register('startDate')} />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-end`}>{t('activity.fields.endDate')}</Label>
          <Input aria-invalid={Boolean(errors.endDate)} id={`${idPrefix}-end`} type="date" {...register('endDate')} />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      <ResponsibleField
        control={control}
        projectId={projectId}
        id={`${idPrefix}-responsible`}
        hasError={Boolean(errors.responsible)}
      />

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
        <Label htmlFor={`${idPrefix}-notes`}>{t('activity.fields.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} rows={3} {...register('notes')} />
      </div>
    </>
  );
}

function NewActivityDialog({
  projectId,
  canReview,
  canCancel,
}: {
  projectId: string;
  canReview: boolean;
  canCancel: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createActivity = useCreateActivity(projectId);
  const { members: assignableCrew } = useAssignableCrew(projectId);

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
        fieldCount={7}
        submitLabel={t('activity.list.newSubmit')}
        isSubmitting={createActivity.isPending}
        error={createActivity.error}
        onSubmit={handleSubmit((values) => {
          // Si el responsable es alguien del personal de obra, la tarea nace
          // con esa persona en la cuadrilla — igual que desde el Tablero —, y
          // así aparece esperada en la asistencia de la Jornada.
          const crewMember = values.responsible.user
            ? undefined
            : assignableCrew.find((member) => member.name === values.responsible.name);
          createActivity.mutate(
            { ...values, ...(crewMember ? { crewMemberIds: [crewMember.id] } : {}) },
            {
              onSuccess: () => {
                setOpen(false);
                reset();
              },
            },
          );
        })}
      >
        <ActivityFormFields
          idPrefix="activity"
          projectId={projectId}
          register={register}
          control={control}
          errors={errors}
          canReview={canReview}
          canCancel={canCancel}
        />
      </FormDrawer>
    </>
  );
}

function EditActivityDialog({
  projectId,
  activity,
  canReview,
  open,
  onOpenChange,
}: {
  projectId: string;
  activity: Activity;
  canReview: boolean;
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
      startDate: activity.startDate,
      endDate: activity.endDate,
      responsible: activity.responsible,
      status: activity.status,
      // Una actividad anterior al cambio no tiene especialidad: llega
      // `undefined`, el selector muestra el placeholder y el schema exige
      // elegirla antes de guardar.
      specialty: activity.specialty as CreateActivityInput['specialty'],
      notes: activity.notes,
    },
  });

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('activity.detail.editTitle')}
      fieldCount={7}
      isSubmitting={updateActivity.isPending}
      error={updateActivity.error}
      onSubmit={handleSubmit((values) =>
        updateActivity.mutate(
          { activityId: activity.id, payload: values },
          { onSuccess: () => onOpenChange(false) },
        ),
      )}
    >
      <ActivityFormFields
        idPrefix="edit-activity"
        projectId={projectId}
        register={register}
        control={control}
        errors={errors}
        canReview={canReview}
        canCancel
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
          <MaterialStatusBadge status={material.status} />
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
  canReview,
}: {
  projectId: string;
  activity: Activity;
  canReview: boolean;
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
        (canReview ? (
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
 * navegación — ver `project-sidebar.tsx`).
 */
function ActivityProvidersSection({
  projectId,
  activityId,
  canAssign,
  canRead,
}: {
  projectId: string;
  activityId: string;
  /** Sumar y sacar proveedores de la tarea: `provider.assign`. */
  canAssign: boolean;
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
  const { data: directoryData } = useProviders(canAssign ? projectId : undefined);
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
              {canAssign && (
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

      {canAssign && (
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
  canWriteEvidence,
}: {
  projectId: string;
  activity: Activity;
  /** Subir y borrar fotos: `activity.evidence.write`. */
  canWriteEvidence: boolean;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadEvidence = useUploadActivityEvidence(projectId, activity.id);
  const deleteEvidence = useDeleteActivityEvidence(projectId, activity.id);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

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
        {canWriteEvidence && (
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
              {canWriteEvidence && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setDeletingPhotoId(photo.id)}
                  aria-label={t('activity.detail.removeEvidence')}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deletingPhotoId !== null}
        onOpenChange={(open) => !open && setDeletingPhotoId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activity.detail.removeEvidenceTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('activity.detail.removeEvidenceBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deletingPhotoId) deleteEvidence.mutate(deletingPhotoId);
                setDeletingPhotoId(null);
              }}
            >
              {t('activity.detail.removeEvidence')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActivityDetailModal({
  projectId,
  activity,
  materials,
  missingMaterials,
  canReview,
  canAssignProviders,
  canWriteEvidence,
  canEdit,
  canReadProviders,
  onClose,
}: {
  projectId: string;
  activity: Activity | undefined;
  materials: MaterialItem[];
  missingMaterials: boolean;
  /** Aprobar y devolver: `activity.review`. */
  canReview: boolean;
  /** Sumar y sacar proveedores: `provider.assign`. */
  canAssignProviders: boolean;
  /** Fotos de avance: `activity.evidence.write`. */
  canWriteEvidence: boolean;
  /** Modificar la tarea: `activity.plan`, sólo el gerente. */
  canEdit: boolean;
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
              {canEdit && (
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
                    <SpecialtyLabel specialty={activity.specialty} />
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
                canReview={canReview}
              />

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <h3 className="text-sm font-medium">{t('activity.detail.materials')}</h3>
                <ActivityMaterialsList materials={materials} />
              </div>

              <ActivityProvidersSection
                projectId={projectId}
                activityId={activity.id}
                canAssign={canAssignProviders}
                canRead={canReadProviders}
              />

              <ActivityEvidenceSection
                projectId={projectId}
                activity={activity}
                canWriteEvidence={canWriteEvidence}
              />

              {activity.notes && (
                <div className="flex flex-col gap-2 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">{t('activity.detail.notes')}</h3>
                  <p className="text-sm text-muted-foreground">{activity.notes}</p>
                </div>
              )}
            </div>

            {canEdit && (
              <EditActivityDialog
                projectId={projectId}
                activity={activity}
                canReview={canReview}
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
  // Abre ubicado en hoy y con la obra entera hasta que la persona elige un
  // rango propio: ahí manda lo que pidió, no el default.
  const [rangeTouched, setRangeTouched] = useState(false);
  const [todayRequest, setTodayRequest] = useState(0);
  // El estado vive en la URL (IA-4): un recargue o un "atrás" no lo pierde.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get('status'));

  const allActivitiesQuery = useAllActivities(projectId);
  const { data: allActivitiesData } = allActivitiesQuery;
  const allActivitiesSettled = allActivitiesQuery.isSuccess || allActivitiesQuery.isError;

  // Rango inicial: la obra completa, no "este mes" — una obra planifica meses a
  // futuro y el default no puede empezar mostrando el gantt vacío — más
  // cualquier tarea corrida fuera de las fechas estimadas (ver `scheduleRange`).
  // Sigue a las tareas mientras la persona no tocó el filtro: una tarea nueva
  // que cae después de la entrega tiene que aparecer, no esperar a un refresh.
  useEffect(() => {
    if (rangeTouched || !projectData || !allActivitiesSettled) return;
    const next = scheduleRange(projectData.project, allActivitiesData?.activities ?? []);
    setRange((current) =>
      current.from === next.from && current.to === next.to ? current : next,
    );
  }, [rangeTouched, projectData, allActivitiesData, allActivitiesSettled]);

  const todayKey = toDayKey(new Date());
  const todayInRange = todayKey >= range.from && todayKey <= range.to;

  const { data: activitiesData, isLoading, isError } = useActivities(projectId, range);
  const { data: materialsData } = useMaterials(projectId);

  const { can } = useProjectCapabilities(projectId);
  const canReadProviders = can('provider.read');

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

  if (isError) return <PageLayout isError />;

  const rangeActivities = activitiesData?.activities ?? [];
  const activities =
    statusFilter.length > 0
      ? rangeActivities.filter((a) => statusFilter.includes(a.status))
      : rangeActivities;
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedActivityMaterials = selectedActivity
    ? (materialsData?.materials ?? []).filter((m) => m.activityId === selectedActivity.id)
    : [];

  return (
    <PageLayout
      width="full"
      fill
      toolbar={
        <>
          <DateRangeFilter
            value={range}
            onChange={(next) => {
              setRangeTouched(true);
              setRange(next);
            }}
            disableFuture={false}
          />
          <ActivityStatusFilter
            value={statusFilter}
            onChange={(next) => {
              setSearchParams(
                (current) => {
                  const params = new URLSearchParams(current);
                  const serialized = serializeStatusFilter(next);
                  if (serialized) params.set('status', serialized);
                  else params.delete('status');
                  return params;
                },
                { replace: true },
              );
            }}
          />
          {(todayInRange || rangeTouched) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // Volver a hoy también vuelve al rango de la obra: es la vista
                // con la que se abre.
                setRangeTouched(false);
                setTodayRequest((n) => n + 1);
              }}
            >
              {t('activity.gantt.goToToday')}
            </Button>
          )}
        </>
      }
      /* El supervisor crea tareas; modificarlas es del gerente. */
      action={
        can('activity.create') ? (
          <NewActivityDialog
            projectId={projectId!}
            canReview={can('activity.review')}
            canCancel={can('activity.plan')}
          />
        ) : undefined
      }
      empty={
        !isLoading && activities.length === 0
          ? {
              icon: CalendarRange,
              // Con el filtro puesto, "no hay tareas" mentiría: hay, en otro estado.
              title:
                rangeActivities.length > 0
                  ? t('activity.gantt.emptyFiltered')
                  : t('activity.gantt.emptyState'),
            }
          : undefined
      }
    >
      {/*
        La carga va adentro y no en lugar de la página: el filtro de fechas
        tiene que seguir en pantalla mientras llegan las tareas del rango nuevo.
      */}
      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <ActivityGantt
          activities={activities}
          range={range}
          onSelectActivity={setSelectedActivityId}
          missingMaterialActivityIds={activitiesWithAlert}
          focusOnToday={!rangeTouched}
          focusRequest={todayRequest}
        />
      )}

      <ActivityDetailModal
        projectId={projectId!}
        activity={selectedActivity}
        materials={selectedActivityMaterials}
        missingMaterials={Boolean(selectedActivityId && activitiesWithAlert.has(selectedActivityId))}
        canReview={can('activity.review')}
        canAssignProviders={can('provider.assign')}
        canWriteEvidence={can('activity.evidence.write')}
        canEdit={can('activity.plan')}
        canReadProviders={canReadProviders}
        onClose={() => setSelectedActivityId(null)}
      />
    </PageLayout>
  );
}

export default ProjectActivitiesPage;
