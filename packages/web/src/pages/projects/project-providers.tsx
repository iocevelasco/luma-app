import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  allowsCustomSpecialty,
  createProviderSchema,
  type CreateProviderInput,
  type Provider,
  type ProviderSpecialty,
} from '@luma/shared';
import { CalendarClock, Pencil, Plus, UserX, X } from 'lucide-react';
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
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
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { RouteError } from '@/components/routes/route-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useAssignActivitiesToProvider,
  useAssignActivityToProvider,
  useCreateProvider,
  useDeactivateProvider,
  useProviderActivities,
  useProviders,
  useUnassignActivityFromProvider,
  useUpdateProvider,
} from '@/hooks/providers/use-provider-queries';
import { useProject } from '@/hooks/projects/use-project-queries';

/** Mismo orden que el enum de `@luma/shared`: primero el catálogo de obra. */
const PROVIDER_SPECIALTIES: ProviderSpecialty[] = [
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

/**
 * Campos del formulario de proveedor, compartidos entre "Nuevo" y "Editar" —
 * mismo criterio que `ActivityFormFields` en `project-activities.tsx`.
 */
function ProviderFormFields({
  idPrefix,
  register,
  control,
  errors,
  specialty,
  showScope = false,
}: {
  idPrefix: string;
  register: UseFormRegister<CreateProviderInput>;
  control: Control<CreateProviderInput>;
  errors: FieldErrors<CreateProviderInput>;
  specialty: ProviderSpecialty | undefined;
  /** Sólo al crear: mover un proveedor de alcance después es otra conversación. */
  showScope?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('provider.fields.name')}</Label>
        <Input id={`${idPrefix}-name`} {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-company`}>{t('provider.fields.companyName')}</Label>
        <Input id={`${idPrefix}-company`} {...register('companyName')} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-specialty`}>{t('provider.fields.specialty')}</Label>
        <Controller
          control={control}
          name="specialty"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={`${idPrefix}-specialty`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_SPECIALTIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`provider.specialty.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {specialty && allowsCustomSpecialty(specialty) && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-custom-specialty`}>
            {specialty === 'acabados'
              ? t('provider.fields.customSpecialtyAcabados')
              : t('provider.fields.customSpecialty')}
          </Label>
          <Input id={`${idPrefix}-custom-specialty`} {...register('customSpecialty')} />
          {errors.customSpecialty && (
            <p className="text-sm text-destructive">{errors.customSpecialty.message}</p>
          )}
        </div>
      )}

      {showScope && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-scope`}>{t('provider.fields.scope')}</Label>
          <Controller
            control={control}
            name="scope"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-scope`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">{t('provider.scope.organization')}</SelectItem>
                  <SelectItem value="project">{t('provider.scope.project')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-sm text-muted-foreground">{t('provider.fields.scopeHint')}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-phone`}>{t('provider.fields.phone')}</Label>
          <Input id={`${idPrefix}-phone`} type="tel" {...register('phone')} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-email`}>{t('provider.fields.email')}</Label>
          <Input id={`${idPrefix}-email`} type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t('provider.fields.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} rows={3} {...register('notes')} />
      </div>
    </>
  );
}

/**
 * Checklist opcional de actividades para asignar apenas se crea el
 * proveedor — el momento típico en que alguien lo agrega es justo porque lo
 * necesita para una actividad puntual, y sin esto había que ir y volver al
 * Cronograma para lo mismo. No es parte de `createProviderSchema`: crear el
 * contacto y asignarlo son dos operaciones distintas en la API (ver
 * `useAssignActivitiesToProvider`), esto sólo encadena la segunda tras la
 * primera.
 */
function AssignOnCreateField({
  projectId,
  selected,
  onToggle,
}: {
  projectId: string;
  selected: Set<string>;
  onToggle: (activityId: string) => void;
}) {
  const { t } = useTranslation();
  const { data } = useAllActivities(projectId);
  const activities = data?.activities ?? [];

  if (activities.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('provider.fields.assignActivities')}</Label>
      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border border-input p-3">
        {activities.map((activity) => (
          <label key={activity.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(activity.id)}
              onCheckedChange={() => onToggle(activity.id)}
            />
            {activity.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function NewProviderDialog({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const createProvider = useCreateProvider(projectId);
  const assignActivities = useAssignActivitiesToProvider(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: { scope: 'organization' },
  });

  function toggleActivity(activityId: string) {
    setSelectedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setSelectedActivityIds(new Set());
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {t('provider.list.new')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('provider.list.newTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            createProvider.mutate(values, {
              onSuccess: (data) => {
                if (selectedActivityIds.size > 0) {
                  assignActivities.mutate({
                    providerId: data.provider.id,
                    activityIds: [...selectedActivityIds],
                  });
                }
                setOpen(false);
                reset();
                setSelectedActivityIds(new Set());
              },
            }),
          )}
        >
          <ProviderFormFields
            idPrefix="provider"
            register={register}
            control={control}
            errors={errors}
            specialty={watch('specialty')}
            showScope
          />
          <AssignOnCreateField
            projectId={projectId}
            selected={selectedActivityIds}
            onToggle={toggleActivity}
          />
          <DialogFooter>
            <Button type="submit" disabled={createProvider.isPending}>
              {createProvider.isPending ? t('common.loading') : t('provider.list.newSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditProviderDialog({
  projectId,
  provider,
  open,
  onOpenChange,
}: {
  projectId: string;
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const updateProvider = useUpdateProvider(projectId);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    // `scope` va acá por coherencia del form, pero `updateProviderSchema` no
    // lo acepta: cambiar el alcance de un proveedor ya creado no es un edit,
    // es una decisión aparte que hoy no existe.
    values: {
      name: provider.name,
      companyName: provider.companyName,
      specialty: provider.specialty,
      customSpecialty: provider.customSpecialty,
      phone: provider.phone,
      email: provider.email,
      notes: provider.notes,
      scope: provider.scope,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('provider.list.editTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            updateProvider.mutate(
              { providerId: provider.id, payload: values },
              { onSuccess: () => onOpenChange(false) },
            ),
          )}
        >
          <ProviderFormFields
            idPrefix="edit-provider"
            register={register}
            control={control}
            errors={errors}
            specialty={watch('specialty')}
          />
          <DialogFooter>
            <Button type="submit" disabled={updateProvider.isPending}>
              {updateProvider.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simétrico de "Proveedores asignados" en el detalle de la Actividad
 * (`project-activities.tsx`), visto desde el proveedor: qué actividades de
 * esta obra ya tiene, y un selector para sumar una más. Mismo alcance que la
 * API — sólo actividades de esta obra, no de todo lo que el proveedor hace
 * en otras obras de la Empresa (ver comentario en provider.controller.ts).
 */
function ProviderActivitiesDialog({
  projectId,
  provider,
  open,
  onOpenChange,
}: {
  projectId: string;
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const { data: assignedData } = useProviderActivities(projectId, open ? provider.id : undefined);
  const { data: allActivitiesData } = useAllActivities(open ? projectId : undefined);
  const assignActivity = useAssignActivityToProvider(projectId, provider.id);
  const unassignActivity = useUnassignActivityFromProvider(projectId, provider.id);

  const assigned = assignedData?.activities ?? [];
  const assignedIds = new Set(assigned.map((activity) => activity.id));
  const available = (allActivitiesData?.activities ?? []).filter(
    (activity) => !assignedIds.has(activity.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('provider.list.activitiesTitle', { name: provider.name })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {assigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('provider.list.noActivities')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {assigned.map((activity) => (
                <li
                  key={activity.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{activity.name}</p>
                    <p className="text-xs text-muted-foreground">{activity.area}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unassignActivity.mutate(activity.id)}
                    aria-label={t('provider.list.unassignActivity')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedActivityId} onValueChange={setSelectedActivityId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder={t('provider.list.assignActivityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {available.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedActivityId || assignActivity.isPending}
              onClick={() => {
                assignActivity.mutate(
                  { activityId: selectedActivityId },
                  { onSuccess: () => setSelectedActivityId('') },
                );
              }}
            >
              <Plus className="size-4" />
              {t('provider.list.assignActivity')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectProvidersPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const { data: providersData, isLoading, isFetching, isError } = useProviders(projectId);
  const deactivateProvider = useDeactivateProvider(projectId!);

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deactivatingProvider, setDeactivatingProvider] = useState<Provider | null>(null);
  const [assigningProvider, setAssigningProvider] = useState<Provider | null>(null);

  // Dueño administra el directorio (crear, editar, dar de baja). Asignar a
  // actividades es escritura operativa, como en Activity: dueño o Asistente.
  const isOwner = Boolean(projectData?.project.isOwner);
  const isEditor = Boolean(projectData?.project.isEditor);

  const columns = useMemo<ResponsiveColumn<Provider>[]>(() => {
    const base: ResponsiveColumn<Provider>[] = [
      {
        id: 'name',
        header: t('provider.fields.name'),
        cell: (provider) => (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{provider.name}</p>
              {/* Sólo se marca la excepción: los de la libreta son el default
                  y etiquetarlos a todos sería ruido. */}
              {provider.scope === 'project' && (
                <Badge variant="secondary">{t('provider.scope.projectBadge')}</Badge>
              )}
            </div>
            {provider.companyName && (
              <p className="text-sm text-muted-foreground">{provider.companyName}</p>
            )}
          </div>
        ),
        mobile: 'primary',
      },
      {
        id: 'specialty',
        header: t('provider.fields.specialty'),
        cell: (provider) =>
          provider.specialty === 'otra'
            ? provider.customSpecialty
            : t(`provider.specialty.${provider.specialty}`),
        mobile: 'secondary',
      },
      {
        id: 'phone',
        header: t('provider.fields.phone'),
        cell: (provider) => provider.phone,
        mobile: 'field',
      },
      {
        id: 'email',
        header: t('provider.fields.email'),
        cell: (provider) => provider.email ?? '—',
        mobile: 'desktopOnly',
      },
    ];

    if (!isEditor) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: '',
        cell: (provider) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setAssigningProvider(provider)}
              aria-label={t('provider.list.activitiesTitle', { name: provider.name })}
            >
              <CalendarClock className="size-4" />
            </Button>
            {isOwner && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setEditingProvider(provider)}
                  aria-label={t('provider.list.editTitle')}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setDeactivatingProvider(provider)}
                  aria-label={t('provider.list.deactivate')}
                >
                  <UserX className="size-4" />
                </Button>
              </>
            )}
          </div>
        ),
        mobile: 'actions',
      },
    ];
  }, [isEditor, isOwner, t]);

  if (isError) return <RouteError />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl">{t('provider.list.title')}</h2>
        {isOwner && <NewProviderDialog projectId={projectId!} />}
      </div>

      <ResponsiveTable
        columns={columns}
        rows={providersData?.providers ?? []}
        getRowKey={(provider) => provider.id}
        isLoading={isLoading}
        isFetching={isFetching}
        empty={
          <EmptyState
            title={t('provider.list.empty')}
            description={isOwner ? t('provider.list.emptyOwnerHint') : undefined}
          />
        }
      />

      {editingProvider && (
        <EditProviderDialog
          projectId={projectId!}
          provider={editingProvider}
          open={Boolean(editingProvider)}
          onOpenChange={(open) => !open && setEditingProvider(null)}
        />
      )}

      {assigningProvider && (
        <ProviderActivitiesDialog
          projectId={projectId!}
          provider={assigningProvider}
          open={Boolean(assigningProvider)}
          onOpenChange={(open) => !open && setAssigningProvider(null)}
        />
      )}

      <AlertDialog
        open={Boolean(deactivatingProvider)}
        onOpenChange={(open) => !open && setDeactivatingProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('provider.list.confirmDeactivateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('provider.list.confirmDeactivateBody', { name: deactivatingProvider?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeactivatingProvider(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivatingProvider) deactivateProvider.mutate(deactivatingProvider.id);
                setDeactivatingProvider(null);
              }}
            >
              {t('common.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProjectProvidersPage;
