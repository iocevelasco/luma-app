import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCrewMemberSchema,
  type CreateCrewMemberInput,
  type OrganizationCrewMember,
} from '@luma/shared';
import { MapPin, Pencil, Plus, UserX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CrewMemberFormFields } from '@/components/crew/crew-member-form-fields';
import { Fab } from '@/components/common/fab';
import { EmptyState } from '@/components/common/empty-state';
import { FormDrawer } from '@/components/common/form-drawer';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { ProjectAssignmentDialog } from '@/components/directory/project-assignment-dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useCreateOrganizationCrewMember,
  useDeactivateOrganizationCrewMember,
  useOrganizationCrew,
  useSetCrewMemberProjects,
  useUpdateOrganizationCrewMember,
} from '@/hooks/organizations/use-organization-queries';

const DEFAULTS: Partial<CreateCrewMemberInput> = {
  kind: 'persona',
  isLead: false,
  scope: 'organization',
};

/**
 * Alta y edición de un empleado de la Empresa.
 *
 * No pide jornal: es el dato que, cruzado con lo cobrado, deja calcular el
 * margen, y si un mismo empleado puede cobrar distinto según la obra es una
 * decisión de producto todavía abierta.
 */
function CrewDrawer({
  member,
  open,
  onOpenChange,
}: {
  /** `null` = alta. */
  member: OrganizationCrewMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateOrganizationCrewMember();
  const update = useUpdateOrganizationCrewMember();
  const mutation = member ? update : create;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateCrewMemberInput>({
    resolver: zodResolver(createCrewMemberSchema),
    values: member
      ? {
          name: member.name,
          kind: member.kind,
          specialty: member.specialty,
          isLead: member.isLead,
          phone: member.phone,
          notes: member.notes,
          scope: 'organization',
        }
      : undefined,
    defaultValues: DEFAULTS,
  });

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      reset(DEFAULTS);
      mutation.reset();
    }
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={close}
      title={member ? t('crew.list.editTitle') : t('crew.list.newTitle')}
      fieldCount={6}
      submitLabel={member ? undefined : t('crew.list.newSubmit')}
      isSubmitting={mutation.isPending}
      error={mutation.error}
      onSubmit={handleSubmit((values) => {
        if (member) {
          const { scope: _scope, ...payload } = values;
          void _scope;
          update.mutate(
            { crewMemberId: member.id, payload },
            { onSuccess: () => close(false) },
          );
        } else {
          create.mutate(values, { onSuccess: () => close(false) });
        }
      })}
    >
      <CrewMemberFormFields
        idPrefix="directory-crew"
        register={register}
        control={control}
        errors={errors}
      />
    </FormDrawer>
  );
}

/**
 * Empleados de la Empresa. Mismo criterio que los proveedores: son de la
 * Empresa y se comparten entre obras, por eso tienen su lugar en la
 * navegación y no adentro de una obra.
 */
export function CrewDirectoryPage() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, error, refetch } = useOrganizationCrew();
  const deactivate = useDeactivateOrganizationCrewMember();
  const setProjects = useSetCrewMemberProjects();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationCrewMember | null>(null);
  const [assigning, setAssigning] = useState<OrganizationCrewMember | null>(null);
  const [deactivating, setDeactivating] = useState<OrganizationCrewMember | null>(null);

  const columns = useMemo<ResponsiveColumn<OrganizationCrewMember>[]>(
    () => [
      {
        id: 'name',
        header: t('directory.name'),
        cell: (member) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{member.name}</span>
            {member.isLead && <Badge variant="secondary">{t('directory.lead')}</Badge>}
          </div>
        ),
        mobile: 'primary',
      },
      {
        id: 'kind',
        header: t('directory.kind'),
        cell: (member) => t(`crew.kind.${member.kind}`),
        mobile: 'secondary',
      },
      {
        id: 'specialty',
        header: t('directory.specialty'),
        cell: (member) =>
          member.specialty ? t(`provider.specialty.${member.specialty}`) : t('directory.noValue'),
        mobile: 'field',
      },
      {
        id: 'phone',
        header: t('directory.phone'),
        cell: (member) => member.phone ?? t('directory.noValue'),
        mobile: 'field',
      },
      {
        id: 'projects',
        header: t('directory.projects'),
        cell: (member) => t('directory.projectsCount', { count: member.projectIds.length }),
        mobile: 'field',
      },
      {
        id: 'actions',
        header: '',
        cell: (member) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setAssigning(member)}
              aria-label={t('directory.projectsTitle', { name: member.name })}
            >
              <MapPin className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => {
                setEditing(member);
                setDrawerOpen(true);
              }}
              aria-label={t('crew.list.editTitle')}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setDeactivating(member)}
              aria-label={t('crew.list.deactivate')}
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

  return (
    <div className="flex flex-col gap-6 p-3 md:p-4">
      <Fab>
        <Button
          onClick={() => {
            setEditing(null);
            setDrawerOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t('crew.list.new')}
        </Button>
      </Fab>

      <ResponsiveTable
        columns={columns}
        rows={data?.crewMembers ?? []}
        getRowKey={(member) => member.id}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        empty={
          <EmptyState
            variant="list"
            title={t('directory.crewEmpty')}
            description={t('directory.emptyHint')}
          />
        }
      />

      <CrewDrawer
        member={editing}
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
              { crewMemberId: assigning.id, projectIds },
              { onSuccess: () => setAssigning(null) },
            )
          }
        />
      )}

      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directory.confirmDeactivateCrewTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directory.confirmDeactivateCrewBody', { name: deactivating?.name ?? '' })}
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
              {t('crew.list.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CrewDirectoryPage;
