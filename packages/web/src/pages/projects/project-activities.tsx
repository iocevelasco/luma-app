import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import {
  createActivitySchema,
  type Activity,
  type ActivityStatus,
  type CreateActivityInput,
  type MaterialItem,
} from '@luma/shared';
import {
  ArrowLeft,
  CalendarRange,
  Camera,
  Check,
  FileDown,
  LayoutGrid,
  List,
  PackageX,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ResponsibleField } from '@/components/activities/responsible-field';
import { SpecialtyLabel } from '@/components/activities/specialty-label';
import { ActivityFilterControls, ActiveFiltersNotice } from '@/components/activities/activity-filter-bar';
import { ActivityGantt, GANTT_ZOOMS, type GanttZoom } from '@/components/activities/activity-gantt';
import { ActivityList } from '@/components/activities/activity-list';
import { TaskBoard } from '@/components/activities/task-board';
import { CrewRosterDialog } from '@/components/crew/crew-roster-dialog';
import { ActivityStatusBadge } from '@/components/common/activity-status-badge';
import { ActivityStatusIcon } from '@/components/common/activity-status-icon';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
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
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/components/ui/use-mobile';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useAllActivities,
  useMoveActivity,
  useRescheduleActivity,
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
import { useActivityFilters } from '@/hooks/activities/use-activity-filters';
import { ACTIVITY_SPECIALTIES, ACTIVITY_STATUSES, MATERIAL_STATUSES_BLOCKING } from '@/lib/activity-catalog';
import { activitiesOfDay } from '@/lib/activities-day-pdf';
import { scheduleRange } from '@/lib/activity-range';
import { applyActivityFilters, countActiveFilters, pruneActivityFilters } from '@/lib/activity-filters';
import { downloadBlob } from '@/lib/download-blob';
import { allowedMoves, taskPeople } from '@/lib/task-board';
import { isWithinNextDays } from '@/lib/week';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

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
  statusMoves,
  canReadProviders,
  canReadMaterials,
  onClose,
}: {
  projectId: string;
  activity: Activity | undefined;
  materials: MaterialItem[];
  /** Compras: `material.read`. Para el cliente depende del flag de la obra. */
  canReadMaterials: boolean;
  missingMaterials: boolean;
  /** Aprobar y devolver: `activity.review`. */
  canReview: boolean;
  /** Sumar y sacar proveedores: `provider.assign`. */
  canAssignProviders: boolean;
  /** Fotos de avance: `activity.evidence.write`. */
  canWriteEvidence: boolean;
  /** Modificar la tarea: `activity.plan`, sólo el gerente. */
  canEdit: boolean;
  /**
   * A qué estados puede llevar esta tarea quien mira (`allowedMoves`, la misma
   * regla del Tablero y de la API). Vacío: el estado se lee y no se cambia.
   */
  statusMoves: ActivityStatus[];
  canReadProviders: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const [editing, setEditing] = useState(false);
  const moveActivity = useMoveActivity(projectId);

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
                  <dd className="mt-1">
                    {statusMoves.length > 0 ? (
                      <Select
                        value={activity.status}
                        onValueChange={(next) =>
                          moveActivity.mutate({ activityId: activity.id, status: next as ActivityStatus })
                        }
                      >
                        <SelectTrigger className="h-8 w-48" aria-label={t('activity.fields.status')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[activity.status, ...statusMoves].map((status) => (
                            <SelectItem key={status} value={status}>
                              <span className="flex items-center gap-2">
                                <ActivityStatusIcon status={status} />
                                {t(`activity.status.${status}`)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      t(`activity.status.${activity.status}`)
                    )}
                  </dd>
                </div>
              </dl>

              <ActivityReviewSection
                projectId={projectId}
                activity={activity}
                canReview={canReview}
              />

              {canReadMaterials && (
                <div className="flex flex-col gap-3 border-t border-border pt-6">
                  <h3 className="text-sm font-medium">{t('activity.detail.materials')}</h3>
                  <ActivityMaterialsList materials={materials} />
                </div>
              )}

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

/**
 * El alto de todo lo que va en la barra de arriba de Actividades: las vistas, el
 * buscador, los filtros, la escala y los botones. Con alturas distintas (48, 36
 * y 32 px) cada control quedaba a un nivel y la barra no leía como una línea.
 * Los contenedores con un segmentado adentro (tabs y escala) llevan `p-1` y
 * sus opciones `h-full`: 40 px en total, igual que el resto.
 */
const TOOLBAR_H = 'h-10';

/** El selector de escala del Cronograma, con la misma superficie suave que los tabs (`ui/tabs.tsx`). */
const SEGMENT_LIST = 'h-10 gap-1 rounded-lg bg-card p-1 shadow-surface';
const SEGMENT_TOGGLE =
  'h-full rounded-md px-4 text-muted-foreground transition-colors duration-300 hover:bg-transparent hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground';

const VIEW_ICON: Record<'gantt' | 'board' | 'list', LucideIcon> = {
  gantt: CalendarRange,
  board: LayoutGrid,
  list: List,
};

type ActivitiesView = 'gantt' | 'board' | 'list';

const ACTIVITIES_VIEWS: readonly ActivitiesView[] = ['gantt', 'board', 'list'];

/** La vista va en la URL (`?vista=`), en castellano como el resto de las rutas. */
const VIEW_PARAM: Record<ActivitiesView, string | null> = {
  gantt: null,
  board: 'tablero',
  list: 'lista',
};

/** Un valor desconocido en `?vista=` cae en el Cronograma: es la vista con la que siempre se abrió. */
function viewFrom(value: string | null): ActivitiesView {
  return ACTIVITIES_VIEWS.find((view) => VIEW_PARAM[view] === value) ?? 'gantt';
}

/**
 * Actividades de la obra, en tres vistas de lo mismo: el Cronograma (qué y
 * cuándo), el Tablero (quién está en qué, esta semana) y la Lista (todo, de
 * arriba abajo). Una tarea ES una actividad: no hay tres listas que se
 * desincronizan, hay una con tres formas de mirarla.
 *
 * Los filtros son **uno solo para las tres**, se recuerdan en el navegador y
 * cuando hay alguno puesto se avisa arriba, con cada uno a un clic de
 * quitarse. Las vistas pestañean sin perder el recorte.
 */
export function ProjectActivitiesPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const dateLocale = useDateLocale();
  const { data: projectData } = useProject(projectId);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<GanttZoom>('weeks');
  const [todayRequest, setTodayRequest] = useState(0);
  const [rosterOpen, setRosterOpen] = useState(false);

  const { data: activitiesData, isLoading, isError } = useAllActivities(projectId);
  const { can } = useProjectCapabilities(projectId);
  // El Tablero muestra quién trabaja en qué y es del personal (`crew.read`),
  // no del cliente (regla 4): para quien no lo tiene la vista no existe, ni
  // en las pestañas ni escribiendo `?vista=tablero` a mano.
  const views = ACTIVITIES_VIEWS.filter((name) => name !== 'board' || can('crew.read'));
  const requestedView = viewFrom(searchParams.get('vista'));
  const view = views.includes(requestedView) ? requestedView : 'gantt';
  const canReadProviders = can('provider.read');
  const canReadMaterials = can('material.read');
  // Sin permiso no se pide: un 403 acá se vería como "sin materiales".
  const { data: materialsData } = useMaterials(canReadMaterials ? projectId : undefined);
  const rescheduleActivity = useRescheduleActivity(projectId!);
  const { filters, update: updateFilters, reset: resetFilters } = useActivityFilters(projectId);

  const activities = useMemo(() => activitiesData?.activities ?? [], [activitiesData]);

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
    const result = new Set<string>();
    for (const activity of activities) {
      if (isWithinNextDays(activity.startDate, 7) && missingByActivity.has(activity.id)) {
        result.add(activity.id);
      }
    }
    return result;
  }, [activities, missingByActivity]);

  const people = useMemo(() => taskPeople(activities), [activities]);

  // Lo guardado puede nombrar a alguien que ya no figura en la obra: se suelta
  // acá, con los datos delante, y no al leer (ahí todavía no hay datos).
  const effectiveFilters = useMemo(
    () => pruneActivityFilters(filters, new Set(people.map((person) => person.key))),
    [filters, people],
  );
  const activeFilters = countActiveFilters(effectiveFilters);

  const visible = useMemo(
    () =>
      applyActivityFilters(activities, effectiveFilters, {
        today: toDayKey(new Date()),
        userId: user?.id,
        missingMaterialIds: missingByActivity,
      }),
    [activities, effectiveFilters, user?.id, missingByActivity],
  );

  // El Cronograma abre con la obra entera —una obra planifica meses a futuro—
  // más cualquier tarea corrida fuera de las fechas estimadas (ver
  // `scheduleRange`). Sale de **todas** las actividades, no de las filtradas:
  // filtrar no puede mover el diagrama de lugar.
  const range = useMemo(
    () => (projectData ? scheduleRange(projectData.project, activities) : null),
    [projectData, activities],
  );

  // Las actividades de hoy, con los filtros puestos: quien filtra por
  // responsable imprime la hoja de esa persona.
  const todayKey = toDayKey(new Date());
  const dayActivities = useMemo(() => activitiesOfDay(visible, todayKey), [visible, todayKey]);
  const [generatingDayPdf, setGeneratingDayPdf] = useState(false);
  const hasDayActivities = dayActivities.length > 0;

  // `jspdf` pesa: se baja apenas la Lista muestra algo para descargar y no al
  // tocar el botón. En Safari, descargar tiene que ocurrir dentro del gesto de
  // la persona, y esperar un chunk grande lo deja afuera.
  useEffect(() => {
    if (view !== 'list' || !hasDayActivities) return;
    void import('@/lib/activities-day-pdf');
    void import('jspdf');
    void import('jspdf-autotable');
  }, [view, hasDayActivities]);

  async function handleDownloadDayPdf() {
    if (generatingDayPdf || !hasDayActivities) return;
    setGeneratingDayPdf(true);
    try {
      const { activitiesDayFileName, buildActivitiesDayPdf } = await import('@/lib/activities-day-pdf');
      const now = new Date();
      const blob = await buildActivitiesDayPdf({
        projectName: projectData?.project.name ?? '',
        today: todayKey,
        dateLabel: format(now, 'PPPP', { locale: dateLocale }),
        activities: dayActivities,
        labels: {
          title: t('activity.dayPdf.title'),
          summary: t('activity.dayPdf.summary', { count: dayActivities.length }),
          filtered: activeFilters > 0 ? t('activity.dayPdf.filtered') : null,
          columns: {
            activity: t('activity.fields.name'),
            specialty: t('activity.fields.specialty'),
            responsible: t('activity.fields.responsible'),
            dates: t('activity.dayPdf.columnDates'),
            status: t('activity.fields.status'),
          },
          noSpecialty: t('activity.detail.noSpecialty'),
          overdue: t('activity.list.overdue'),
          generated: t('activity.dayPdf.generated', { date: format(now, 'Pp', { locale: dateLocale }) }),
          page: (page, total) => t('activity.dayPdf.page', { page, total }),
          specialty: (specialty) => t(`provider.specialty.${specialty}`),
          status: (status) => t(`activity.status.${status}`),
          day: (dayKey) => format(fromDayKey(dayKey), 'd MMM', { locale: dateLocale }),
        },
      });
      downloadBlob(blob, activitiesDayFileName(projectData?.project.name ?? '', now));
      toast.success(t('activity.dayPdf.downloaded'));
    } catch {
      toast.error(t('activity.dayPdf.error'));
    } finally {
      setGeneratingDayPdf(false);
    }
  }

  if (isError) return <PageLayout isError />;
  if (isLoading || !projectData || !range) return <PageLayout isLoading />;

  const selectedActivity = activities.find((a) => a.id === selectedActivityId);
  const selectedActivityMaterials = selectedActivity
    ? (materialsData?.materials ?? []).filter((m) => m.activityId === selectedActivity.id)
    : [];

  const empty =
    activities.length === 0
      ? { icon: CalendarRange, title: t('activity.views.emptyTitle'), description: t('activity.views.emptyBody') }
      : visible.length === 0
        ? {
            icon: CalendarRange,
            title: t('activity.filters.emptyTitle'),
            description: t('activity.filters.emptyBody', { count: activeFilters }),
          }
        : undefined;

  return (
    <>
      <Tabs
        value={view}
        onValueChange={(next) => {
          const param = VIEW_PARAM[next as ActivitiesView];
          // `replace`: cambiar de vista no es navegar, y "atrás" vuelve a la pantalla anterior.
          setSearchParams(param ? { vista: param } : {}, { replace: true });
        }}
      >
        <PageLayout
          width={view === 'list' ? 'default' : 'full'}
          // El Cronograma y el Tablero ocupan el alto que queda de la ventana: las columnas
          // del Tablero tienen que llegar hasta abajo, o soltar una tarea en la parte vacía
          // de una columna no cuenta. En el celular el Tablero es una lista y scrollea la página.
          fill={view === 'gantt' || (view === 'board' && !isMobile)}
          // El aviso de filtros flota abajo: mientras haya filtros, el contenido le deja lugar.
          reserveBottom={activeFilters > 0}
          toolbar={
            <>
              <TabsList aria-label={t('activity.views.aria')} className="h-10 p-1">
                {views.map((name) => (
                  <TabsTrigger key={name} value={name} icon={VIEW_ICON[name]} className="h-full">
                    {t(`activity.views.${name}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ActivityFilterControls
                filters={effectiveFilters}
                onChange={updateFilters}
                onReset={resetFilters}
                people={people}
                canFilterMaterials={canReadMaterials}
                canFilterReview={can('activity.review')}
              />
              <ActiveFiltersNotice
                filters={effectiveFilters}
                onChange={updateFilters}
                onReset={resetFilters}
                people={people}
              />
            </>
          }
          secondaryActions={
            view === 'gantt' ? (
              <>
                {/* La misma superficie suave que las vistas: un segmentado con aire entre opciones. */}
                <ToggleGroup
                  type="single"
                  size="sm"
                  value={zoom}
                  aria-label={t('activity.gantt.zoomLabel')}
                  onValueChange={(next) => next && setZoom(next as GanttZoom)}
                  className={SEGMENT_LIST}
                >
                  {GANTT_ZOOMS.map((level) => (
                    <ToggleGroupItem
                      key={level}
                      value={level}
                      className={cn('first:rounded-md last:rounded-md', SEGMENT_TOGGLE)}
                    >
                      {t(`activity.gantt.zoom.${level}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Button
                  type="button"
                  variant="outline"
                  className={TOOLBAR_H}
                  onClick={() => setTodayRequest((n) => n + 1)}
                >
                  {t('activity.gantt.goToToday')}
                </Button>
              </>
            ) : view === 'list' ? (
              // La hoja del día, en tamaño carta, para imprimir y llevar a la obra.
              <Button
                type="button"
                variant="outline"
                className={cn(TOOLBAR_H, 'max-sm:min-h-11')}
                disabled={generatingDayPdf || !hasDayActivities}
                aria-busy={generatingDayPdf}
                onClick={() => void handleDownloadDayPdf()}
              >
                {generatingDayPdf ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
                {generatingDayPdf ? t('activity.dayPdf.generating') : t('activity.dayPdf.button')}
                {!generatingDayPdf && (
                  <span className="tabular-nums text-muted-foreground">{dayActivities.length}</span>
                )}
              </Button>
            ) : view === 'board' && can('crew.create') ? (
              <Button variant="outline" className={TOOLBAR_H} onClick={() => setRosterOpen(true)}>
                <Users className="size-4" />
                {t('crew.list.title')}
              </Button>
            ) : undefined
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
          // El Tablero nunca se reemplaza por el vacío: es desde sus columnas (el alta
          // rápida) que se carga la primera tarea.
          empty={view === 'board' ? undefined : empty}
        >
          {view === 'gantt' && (
            <ActivityGantt
              activities={visible}
              range={range}
              zoom={zoom}
              onSelectActivity={setSelectedActivityId}
              onReschedule={
                can('activity.plan')
                  ? (activityId, startDate, endDate) =>
                      rescheduleActivity.mutate({ activityId, startDate, endDate })
                  : undefined
              }
              focusOnToday
              focusRequest={todayRequest}
            />
          )}
          {view === 'board' && (
            <TaskBoard
              projectId={projectId!}
              activities={visible}
              onSelectActivity={setSelectedActivityId}
            />
          )}
          {view === 'list' && (
            <ActivityList
              activities={visible}
              missingMaterialIds={missingByActivity}
              onSelectActivity={setSelectedActivityId}
            />
          )}
        </PageLayout>
      </Tabs>

      <ActivityDetailModal
        projectId={projectId!}
        activity={selectedActivity}
        materials={selectedActivityMaterials}
        missingMaterials={Boolean(selectedActivityId && activitiesWithAlert.has(selectedActivityId))}
        canReview={can('activity.review')}
        canAssignProviders={can('provider.assign')}
        canWriteEvidence={can('activity.evidence.write')}
        canEdit={can('activity.plan')}
        statusMoves={selectedActivity ? allowedMoves(selectedActivity.status, can) : []}
        canReadProviders={canReadProviders}
        canReadMaterials={canReadMaterials}
        onClose={() => setSelectedActivityId(null)}
      />

      <CrewRosterDialog
        projectId={projectId!}
        canManage={can('crew.manage')}
        open={rosterOpen}
        onOpenChange={setRosterOpen}
      />
    </>
  );
}

export default ProjectActivitiesPage;
