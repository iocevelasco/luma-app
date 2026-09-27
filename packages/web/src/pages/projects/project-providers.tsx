import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProviderSchema,
  type CreateProviderInput,
  type Provider,
  type ProviderSpecialty,
} from '@luma/shared';
import { Pencil, Plus, UserX } from 'lucide-react';
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
import {
  useCreateProvider,
  useDeactivateProvider,
  useProviders,
  useUpdateProvider,
} from '@/hooks/providers/use-provider-queries';
import { useProject } from '@/hooks/projects/use-project-queries';

const PROVIDER_SPECIALTIES: ProviderSpecialty[] = [
  'electricidad',
  'plomeria',
  'gas',
  'carpinteria',
  'albanileria',
  'pintura',
  'herreria',
  'techos',
  'climatizacion',
  'pisos_revestimientos',
  'vidrieria',
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
}: {
  idPrefix: string;
  register: UseFormRegister<CreateProviderInput>;
  control: Control<CreateProviderInput>;
  errors: FieldErrors<CreateProviderInput>;
  specialty: ProviderSpecialty | undefined;
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

      {specialty === 'otra' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-custom-specialty`}>{t('provider.fields.customSpecialty')}</Label>
          <Input id={`${idPrefix}-custom-specialty`} {...register('customSpecialty')} />
          {errors.customSpecialty && (
            <p className="text-sm text-destructive">{errors.customSpecialty.message}</p>
          )}
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

function NewProviderDialog({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createProvider = useCreateProvider(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProviderInput>({ resolver: zodResolver(createProviderSchema) });

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
              onSuccess: () => {
                setOpen(false);
                reset();
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
    values: {
      name: provider.name,
      companyName: provider.companyName,
      specialty: provider.specialty,
      customSpecialty: provider.customSpecialty,
      phone: provider.phone,
      email: provider.email,
      notes: provider.notes,
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

export function ProjectProvidersPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const { data: providersData, isLoading, isFetching, isError } = useProviders(projectId);
  const deactivateProvider = useDeactivateProvider(projectId!);

  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [deactivatingProvider, setDeactivatingProvider] = useState<Provider | null>(null);

  // Dueño administra el directorio; el Asistente de Obra sólo lo consulta
  // (lo asigna a actividades desde el detalle de cada una).
  const isOwner = Boolean(projectData?.project.isOwner);

  const columns = useMemo<ResponsiveColumn<Provider>[]>(() => {
    const base: ResponsiveColumn<Provider>[] = [
      {
        id: 'name',
        header: t('provider.fields.name'),
        cell: (provider) => (
          <div>
            <p className="font-medium">{provider.name}</p>
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

    if (!isOwner) return base;

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
          </div>
        ),
        mobile: 'actions',
      },
    ];
  }, [isOwner, t]);

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
