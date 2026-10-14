import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCrewMemberSchema,
  type CreateCrewMemberInput,
  type OrganizationCrewMember,
} from '@luma/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CrewMemberFormFields } from '@/components/crew/crew-member-form-fields';
import { FormDrawer } from '@/components/common/form-drawer';
import { Button } from '@/components/ui/button';
import {
  useCreateOrganizationCrewMember,
  useUpdateOrganizationCrewMember,
} from '@/hooks/organizations/use-organization-queries';
import { crewDuplicateOf } from '@/lib/crew-directory';

/** Todos los campos: `reset` sólo limpia lo que está acá — ver `AddCrewDrawer`. */
const DEFAULTS: CreateCrewMemberInput = {
  name: '',
  kind: 'persona',
  specialty: undefined,
  isLead: false,
  phone: '',
  notes: '',
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
    watch,
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
        }
      : undefined,
    defaultValues: DEFAULTS,
  });

  /*
    El alta pasa por el mismo guardia de duplicados que la de una obra. Desde
    acá no hay obra a la cual sumarlo: las salidas son reactivar a quien está
    dado de baja (es la misma persona que vuelve) y, si sólo coincide el
    nombre, "es otra persona". Con el mismo teléfono y activo, no hay salida:
    ya está en la libreta.
  */
  const duplicate = member ? null : crewDuplicateOf(create.error);

  // Si cambia lo que identifica a la persona, el 409 ya no corresponde.
  const resetCreate = create.reset;
  useEffect(() => {
    const subscription = watch((_, { name: field }) => {
      if (field === 'name' || field === 'phone' || field === 'kind') resetCreate();
    });
    return () => subscription.unsubscribe();
  }, [watch, resetCreate]);
  const submit = (allowDuplicateName: boolean) =>
    handleSubmit((values) => {
      if (member) {
        update.mutate(
          { crewMemberId: member.id, payload: values },
          { onSuccess: () => close(false) },
        );
      } else {
        create.mutate(
          { ...values, ...(allowDuplicateName ? { allowDuplicateName: true } : {}) },
          { onSuccess: () => close(false) },
        );
      }
    });

  const duplicateActions = duplicate ? (
    <>
      {!duplicate.existing.active && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { crewMemberId: duplicate.existing.id, payload: { active: true } },
              { onSuccess: () => close(false) },
            )
          }
        >
          {t('crew.add.reactivateInCompany')}
        </Button>
      )}
      {duplicate.reason === 'name' && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={create.isPending}
          onClick={() => void submit(true)()}
        >
          {t('crew.add.differentPerson')}
        </Button>
      )}
    </>
  ) : undefined;

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      reset(DEFAULTS);
      create.reset();
      update.reset();
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
      // En un alta, `update` sólo corre para reactivar desde el banner: si
      // eso falla, es el error que la persona acaba de provocar.
      error={(!member && update.error) || mutation.error}
      onSubmit={submit(false)}
      errorActions={duplicateActions}
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
