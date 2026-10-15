import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProviderSchema, type CreateProviderInput, type OrganizationProvider } from '@luma/shared';
import { MapPin, Pencil, Plus, UserX, Wrench } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { PageLayout } from '@/components/layout/page-layout';
import { ProjectAssignmentDialog } from '@/components/directory/project-assignment-dialog';
import { ProviderFormFields } from '@/components/providers/provider-form-fields';
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
import { Button } from '@/components/ui/button';
import {
  useCreateOrganizationProvider,
  useDeactivateOrganizationProvider,
  useOrganizationProviders,
  useSetProviderProjects,
  useUpdateOrganizationProvider,
} from '@/hooks/organizations/use-organization-queries';

/**
 * Proveedores de la Empresa. Al mismo nivel que Obras en la navegación porque
 * no pertenecen a una obra: el mismo carpintero trabaja en varias. Acá se
 * da de alta, se corrige, se da de baja y se decide en qué obras está; cada
 * obra después dispone sólo de los que tiene asignados.
 */
function ProviderDrawer({
  provider,
  open,
  onOpenChange,
}: {
  /** `null` = alta. */
  provider: OrganizationProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateOrganizationProvider();
  const update = useUpdateOrganizationProvider();
  const mutation = provider ? update : create;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    values: provider
      ? {
          name: provider.name,
          companyName: provider.companyName,
          specialty: provider.specialty,
          customSpecialty: provider.customSpecialty,
          phone: provider.phone,
          email: provider.email,
          notes: provider.notes,
          scope: 'organization',
        }
      : undefined,
    defaultValues: { scope: 'organization' },
  });

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      reset({ scope: 'organization' });
      mutation.reset();
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={close}
      title={provider ? t('provider.list.editTitle') : t('provider.list.newTitle')}
      fieldCount={7}
      submitLabel={provider ? undefined : t('provider.list.newSubmit')}
      isSubmitting={mutation.isPending}
      error={mutation.error}
      onSubmit={handleSubmit((values) => {
        if (provider) {
          update.mutate(
            { providerId: provider.id, payload: values },
            { onSuccess: () => close(false) },
          );
        } else {
          create.mutate(values, { onSuccess: () => close(false) });
        }
      })}
    >
      <ProviderFormFields
        idPrefix="directory-provider"
        register={register}
        control={control}
        errors={errors}
        specialty={watch('specialty')}
      />
    </FormDrawer>
  );
}

export function ProvidersDirectoryPage() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, error, refetch } = useOrganizationProviders();
  const deactivate = useDeactivateOrganizationProvider();
  const setProjects = useSetProviderProjects();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationProvider | null>(null);
  const [assigning, setAssigning] = useState<OrganizationProvider | null>(null);
  const [deactivating, setDeactivating] = useState<OrganizationProvider | null>(null);

  const columns = useMemo<ResponsiveColumn<OrganizationProvider>[]>(
    () => [
      {
        id: 'name',
        header: t('directory.name'),
        cell: (provider) => (
          <div>
            <span className="font-medium">{provider.name}</span>
            {provider.companyName && (
              <p className="text-sm text-muted-foreground">{provider.companyName}</p>
            )}
          </div>
        ),
        mobile: 'primary',
      },
      {
        id: 'specialty',
        header: t('directory.specialty'),
        cell: (provider) =>
          provider.specialty === 'otra'
            ? (provider.customSpecialty ?? t('directory.noValue'))
            : t(`provider.specialty.${provider.specialty}`),
        mobile: 'secondary',
      },
      {
        id: 'phone',
        header: t('directory.phone'),
        cell: (provider) => provider.phone,
        mobile: 'field',
      },
      {
        id: 'projects',
        header: t('directory.projects'),
        cell: (provider) => t('directory.projectsCount', { count: provider.projectIds.length }),
        mobile: 'field',
      },
      {
        id: 'actions',
        header: '',
        cell: (provider) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setAssigning(provider)}
              aria-label={t('directory.projectsTitle', { name: provider.name })}
            >
              <MapPin className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => {
                setEditing(provider);
                setDrawerOpen(true);
              }}
              aria-label={t('provider.list.editTitle')}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setDeactivating(provider)}
              aria-label={t('provider.list.deactivate')}
            >
              <UserX className="size-4" />
            </Button>
          </div>
        ),
        mobile: 'actions',
      },
    ],
    [t],
  );

  const providers = data?.providers ?? [];

  return (
    <PageLayout
      isLoading={isLoading}
      action={
        <Button
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t('provider.list.new')}
        </Button>
      }
      empty={
        !error && providers.length === 0
          ? {
              icon: Wrench,
              title: t('directory.providersEmpty'),
              description: t('directory.emptyHint'),
            }
          : undefined
      }
    >
      <ResponsiveTable
        columns={columns}
        rows={providers}
        getRowKey={(provider) => provider.id}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
      />

      <ProviderDrawer
        provider={editing}
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
      />

      {assigning && (
        <ProjectAssignmentDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setAssigning(null);
              setProjects.reset();
            }
          }}
          title={t('directory.projectsTitle', { name: assigning.name })}
          initialProjectIds={assigning.projectIds}
          isSubmitting={setProjects.isPending}
          error={setProjects.error}
          onSave={(projectIds) =>
            setProjects.mutate(
              { providerId: assigning.id, projectIds },
              { onSuccess: () => setAssigning(null) },
            )
          }
        />
      )}

      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directory.confirmDeactivateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directory.confirmDeactivateBody', { name: deactivating?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivating) deactivate.mutate(deactivating.id);
                setDeactivating(null);
              }}
            >
              {t('provider.list.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

export default ProvidersDirectoryPage;
