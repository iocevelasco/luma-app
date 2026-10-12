import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCrewMemberSchema,
  type CreateCrewMemberInput,
  type OrganizationCrewMember,
} from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CrewMemberFormFields } from '@/components/crew/crew-member-form-fields';
import { FormDrawer } from '@/components/common/form-drawer';
import {
  useCreateOrganizationCrewMember,
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
export function CrewDrawer({
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
