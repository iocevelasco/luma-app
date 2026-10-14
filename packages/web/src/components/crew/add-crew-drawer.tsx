import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { createCrewMemberSchema, type CreateCrewMemberInput } from '@luma/shared';
import { UserPlus } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { CrewMemberFormFields } from '@/components/crew/crew-member-form-fields';
import { Button } from '@/components/ui/button';
import {
  useAddCrewMemberToProject,
  useCreateCrewMember,
  useCrewDirectory,
} from '@/hooks/crew/use-crew-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { crewDuplicateOf, matchCrewDirectory } from '@/lib/crew-directory';

/**
 * Todos los campos, también los opcionales: `reset` sólo limpia lo que está
 * acá. Sin `phone: ''`, el teléfono del alta anterior quedaba en el input y
 * viajaba con la siguiente — y el guardia la bloqueaba como duplicado.
 */
const DEFAULTS: CreateCrewMemberInput = {
  name: '',
  kind: 'persona',
  specialty: undefined,
  isLead: false,
  phone: '',
  notes: '',
};

/**
 * Sumar personal a una obra, sin duplicarlo en la Empresa.
 *
 * Mismos campos que el alta de Empleados, con una diferencia: mientras se
 * tipea el nombre aparecen los de la Empresa que todavía no están en esta
 * obra, con **Sumar a esta obra**. El caso común —alguien que ya trabajó en
 * otra obra— se resuelve sin llenar el resto del formulario y sin crear un
 * segundo registro.
 *
 * Si igual se crea y el servidor detecta que ya existe (otro teléfono
 * escrito igual, alguien cargándolo a la vez), el 409 trae a la persona y el
 * banner ofrece la salida: sumarla, reactivarla o "es otra persona".
 *
 * Lo usan el gerente y el supervisor (`crew.create`). Reactivar a alguien
 * dado de baja es del gerente (`crew.manage`).
 */
export function AddCrewDrawer({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { can } = useProjectCapabilities(projectId);
  const create = useCreateCrewMember(projectId);
  const addExisting = useAddCrewMemberToProject(projectId);
  const { data: directoryData } = useCrewDirectory(projectId, open);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateCrewMemberInput>({
    resolver: zodResolver(createCrewMemberSchema),
    defaultValues: DEFAULTS,
  });

  const name = useWatch({ control, name: 'name' }) ?? '';
  const suggestions = useMemo(
    () => matchCrewDirectory(directoryData?.crewMembers ?? [], name),
    [directoryData, name],
  );

  const duplicate = crewDuplicateOf(create.error);

  /*
    El 409 habla de lo que se mandó. Si después se cambia el nombre, el
    teléfono o el tipo, el banner ya no corresponde: "Es otra persona"
    insistiría con datos que nunca chocaron, y "Sumar a esta obra" sumaría a
    alguien que ya no es el del formulario.
  */
  const resetCreate = create.reset;
  useEffect(() => {
    const subscription = watch((_, { name: field }) => {
      if (field === 'name' || field === 'phone' || field === 'kind') resetCreate();
    });
    return () => subscription.unsubscribe();
  }, [watch, resetCreate]);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      reset(DEFAULTS);
      create.reset();
      addExisting.reset();
    }
  }

  function addToProject(crewMemberId: string, reactivate = false) {
    addExisting.mutate({ crewMemberId, reactivate }, { onSuccess: () => close(false) });
  }

  const submit = (allowDuplicateName: boolean) =>
    handleSubmit((values) => {
      addExisting.reset();
      create.mutate(
        { ...values, ...(allowDuplicateName ? { allowDuplicateName: true } : {}) },
        { onSuccess: () => close(false) },
      );
    });

  /*
    Las salidas del 409, adentro del banner que lo explica:

    - dado de baja → reactivarlo (gerente), aunque siga vinculado a la obra:
      no aparece en ninguna lista y no hay otra forma de traerlo de vuelta;
    - activo y fuera de esta obra → sumarlo;
    - mismo nombre → "es otra persona", también si el homónimo ya está acá:
      dos Juan Pérez en la misma obra existen. Con el mismo teléfono no.
  */
  let existingAction: ReactNode = null;
  if (duplicate && !duplicate.existing.active) {
    existingAction = can('crew.manage') ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={addExisting.isPending}
        onClick={() => addToProject(duplicate.existing.id, true)}
      >
        {t('crew.add.reactivate')}
      </Button>
    ) : (
      <span className="text-sm">{t('crew.add.askToReactivate')}</span>
    );
  } else if (duplicate && !duplicate.alreadyInProject) {
    existingAction = (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={addExisting.isPending}
        onClick={() => addToProject(duplicate.existing.id)}
      >
        {t('crew.add.addExisting')}
      </Button>
    );
  }

  const duplicateActions = duplicate ? (
    <>
      {existingAction}
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

  const suggestionList =
    suggestions.length > 0 ? (
      <div className="flex flex-col gap-1 rounded-md border border-border p-2">
        <p className="px-1 text-xs text-muted-foreground">{t('crew.add.suggestionsTitle')}</p>
        <ul className="flex flex-col">
          {suggestions.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{entry.name}</p>
                {/* El teléfono es lo que distingue a dos homónimos. */}
                {(entry.specialty || entry.kind === 'equipo' || entry.phone) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      entry.kind === 'equipo' ? t('crew.kind.equipo') : null,
                      entry.specialty ? t(`provider.specialty.${entry.specialty}`) : null,
                      entry.phone ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={addExisting.isPending}
                onClick={() => addToProject(entry.id)}
              >
                <UserPlus className="size-4" />
                {t('crew.add.addExisting')}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <FormDrawer
      open={open}
      onOpenChange={close}
      title={t('crew.add.title')}
      description={t('crew.add.description')}
      fieldCount={6}
      submitLabel={t('crew.add.submit')}
      isSubmitting={create.isPending}
      // Falla al guardar → banner, nunca toast. Si falló sumar a alguien
      // existente, ese es el error que la persona acaba de provocar.
      error={addExisting.error ?? create.error}
      errorActions={addExisting.error ? undefined : duplicateActions}
      onSubmit={submit(false)}
    >
      <CrewMemberFormFields
        idPrefix="add-crew"
        register={register}
        control={control}
        errors={errors}
        nameAddon={suggestionList}
      />
    </FormDrawer>
  );
}

export default AddCrewDrawer;
