import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProviderSchema,
  type CreateProviderInput,
  type Provider,
} from '@luma/shared';
import {
  Building2,
  CalendarClock,
  FileSignature,
  Package,
  Pencil,
  Plus,
  UserMinus,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { SpecialtyLabel } from '@/components/activities/specialty-label';
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
import { FormDrawer } from '@/components/common/form-drawer';
import { ProviderFormFields } from '@/components/providers/provider-form-fields';
import { DirectoryPickerDialog } from '@/components/directory/directory-picker-dialog';
import { ProviderEngagementDialog } from '@/components/providers/provider-engagement-dialog';
import { ProviderMaterialsDialog } from '@/components/providers/provider-materials-dialog';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { RowCardAction, RowCardMenu, RowCardMenuItem } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useAssignActivitiesToProvider,
  useAddProviderToProject,
  useAssignActivityToProvider,
  useCreateProvider,
  useDeactivateProvider,
  useProviderActivities,
  useProviderDirectory,
  useRemoveProviderFromProject,
  useProviders,
  useUnassignActivityFromProvider,
  useUpdateProvider,
} from '@/hooks/providers/use-provider-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useProject } from '@/hooks/projects/use-project-queries';

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

function NewProviderDialog({ projectId, canManage }: { projectId: string; canManage: boolean }) {
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
    // Sin `provider.manage` el alta es de esta obra: la API lo fuerza igual.
    defaultValues: { scope: canManage ? 'organization' : 'project' },
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
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('provider.list.new')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            reset();
            // Sin esto, un error de un intento anterior reaparece al reabrir.
            createProvider.reset();
            setSelectedActivityIds(new Set());
          }
        }}
        title={t('provider.list.newTitle')}
        fieldCount={8}
        submitLabel={t('provider.list.newSubmit')}
        isSubmitting={createProvider.isPending}
        error={createProvider.error}
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
          showScope={canManage}
        />
        <AssignOnCreateField
          projectId={projectId}
          selected={selectedActivityIds}
          onToggle={toggleActivity}
        />
      </FormDrawer>
    </>
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
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('provider.list.editTitle')}
      fieldCount={7}
      isSubmitting={updateProvider.isPending}
      error={updateProvider.error}
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
    </FormDrawer>
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
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('provider.list.activitiesTitle', { name: provider.name })}
      size="md"
    >
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
                    <p className="text-xs text-muted-foreground"><SpecialtyLabel specialty={activity.specialty} /></p>
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
    </FormDrawer>
  );
}

export function ProjectProvidersPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const { data: providersData, isLoading, isFetching, isError } = useProviders(projectId);
  const deactivateProvider = useDeactivateProvider(projectId!);
  const removeFromProject = useRemoveProviderFromProject(projectId!);
  const addToProject = useAddProviderToProject(projectId!);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: directoryData, isLoading: directoryLoading } = useProviderDirectory(
    projectId,
    pickerOpen,
  );

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deactivatingProvider, setDeactivatingProvider] = useState<Provider | null>(null);
  const [removingProvider, setRemovingProvider] = useState<Provider | null>(null);
  const [assigningProvider, setAssigningProvider] = useState<Provider | null>(null);
  const [contractingProvider, setContractingProvider] = useState<Provider | null>(null);
  const [materialsProvider, setMaterialsProvider] = useState<Provider | null>(null);

  // El directorio (crear, editar, dar de baja, traer de la Empresa) es del
  // gerente; asignar a tareas y abrir la contratación lo hace también quien
  // está en la obra. Quién es cada uno lo dice la grilla, no esta pantalla.
  const { can } = useProjectCapabilities(projectId);
  const canManage = can('provider.manage');
  const canAssign = can('provider.assign');
  // El cliente puede ver proveedores (si la obra lo habilita) pero no Compras.
  const canReadMaterials = can('material.read');
  const canCreate = can('provider.create');

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
                <Badge variant="info">{t('provider.scope.projectBadge')}</Badge>
              )}
            </div>
            {provider.companyName && (
              <p className="text-xs text-muted-foreground">{provider.companyName}</p>
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

    if (!canAssign) return base;

    return [
      ...base,
      {
        id: 'actions',
        header: '',
        // Una acción visible —abrir la contratación, el paso siguiente con un
        // proveedor de la obra— y el resto en "…" (IA-11).
        cell: (provider) => (
          <div className="flex items-center justify-end gap-2">
            <RowCardAction
              type="button"
              onClick={() => setContractingProvider(provider)}
              aria-label={t('engagement.title', { name: provider.name })}
            >
              <FileSignature aria-hidden className="size-4" />
              {t('provider.list.engagementAction')}
            </RowCardAction>
            <RowCardMenu label={t('common.moreActions', { name: provider.name })}>
              <RowCardMenuItem onSelect={() => setAssigningProvider(provider)}>
                <CalendarClock className="size-4" />
                {t('provider.list.activitiesAction')}
              </RowCardMenuItem>
              {canReadMaterials && (
                <RowCardMenuItem onSelect={() => setMaterialsProvider(provider)}>
                  <Package className="size-4" />
                  {t('provider.materials.action')}
                </RowCardMenuItem>
              )}
              {canManage && (
                <>
                  <RowCardMenuItem onSelect={() => setEditingProvider(provider)}>
                    <Pencil className="size-4" />
                    {t('common.edit')}
                  </RowCardMenuItem>
                  <DropdownMenuSeparator />
                  {/* De la libreta de la Empresa: se saca DE ESTA OBRA, no se da de
                      baja — la baja es de la Empresa y alcanza a todas las obras. */}
                  {provider.scope === 'project' ? (
                    <RowCardMenuItem variant="destructive" onSelect={() => setDeactivatingProvider(provider)}>
                      <UserX className="size-4" />
                      {t('provider.list.deactivate')}
                    </RowCardMenuItem>
                  ) : (
                    <RowCardMenuItem variant="destructive" onSelect={() => setRemovingProvider(provider)}>
                      <UserMinus className="size-4" />
                      {t('directory.removeFromProject')}
                    </RowCardMenuItem>
                  )}
                </>
              )}
            </RowCardMenu>
          </div>
        ),
        mobile: 'actions',
      },
    ];
  }, [canAssign, canManage, canReadMaterials, t]);

  if (isError) return <PageLayout isError />;

  return (
    <>
      <PageLayout
        isLoading={isLoading}
        action={canCreate ? <NewProviderDialog projectId={projectId!} canManage={canManage} /> : undefined}
        secondaryActions={
          canManage ? (
            <Button variant="outline" onClick={() => setPickerOpen(true)}>
              <Building2 className="size-4" />
              {t('directory.addFromCompany')}
            </Button>
          ) : undefined
        }
        empty={
          (providersData?.providers.length ?? 0) === 0
            ? {
                icon: Wrench,
                title: t('provider.list.empty'),
                description: canManage ? t('provider.list.emptyOwnerHint') : undefined,
              }
            : undefined
        }
      >
        <ResponsiveTable
          columns={columns}
          rows={providersData?.providers ?? []}
          getRowKey={(provider) => provider.id}
          isFetching={isFetching}
        />
      </PageLayout>

      {/* Afuera de PageLayout: con la obra sin proveedores, "Agregar de la
          Empresa" es la salida del vacío, y adentro no se montaba. */}
      <DirectoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('directory.pickProviderTitle')}
        items={(directoryData?.providers ?? []).map((provider) => ({
          id: provider.id,
          name: provider.name,
          detail:
            provider.specialty === 'otra'
              ? provider.customSpecialty
              : t(`provider.specialty.${provider.specialty}`),
        }))}
        isLoading={directoryLoading}
        pendingId={addToProject.isPending ? addToProject.variables : null}
        emptyLabel={t('directory.pickEmptyProviders')}
        onAdd={(id) => addToProject.mutate(id)}
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

      {materialsProvider && (
        <ProviderMaterialsDialog
          projectId={projectId!}
          provider={materialsProvider}
          open={Boolean(materialsProvider)}
          onOpenChange={(open) => !open && setMaterialsProvider(null)}
        />
      )}

      {contractingProvider && (
        <ProviderEngagementDialog
          projectId={projectId!}
          provider={contractingProvider}
          currency={projectData?.project.currency ?? ''}
          open={Boolean(contractingProvider)}
          onOpenChange={(open) => !open && setContractingProvider(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(removingProvider)}
        onOpenChange={(open) => !open && setRemovingProvider(null)}
        title={t('directory.confirmRemoveFromProjectTitle')}
        description={t('directory.confirmRemoveFromProjectBody', { name: removingProvider?.name ?? '' })}
        confirmLabel={t('directory.removeFromProject')}
        onConfirm={() => removingProvider && removeFromProject.mutate(removingProvider.id)}
      />

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
    </>
  );
}

export default ProjectProvidersPage;
