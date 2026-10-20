import { zodResolver } from '@hookform/resolvers/zod';
import { editMaterialSchema, type EditMaterialInput, type MaterialItem } from '@luma/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useCreateMaterial, useEditMaterial } from '@/hooks/materials/use-material-queries';
import { isApiError } from '@/lib/api-client';

export const MATERIAL_UNITS = ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'] as const;

/** `Select` no admite un valor vacío: este es el "ninguna" de la tarea. */
const NO_ACTIVITY = '__none__';

const EMPTY_VALUES: Partial<EditMaterialInput> = {};

function valuesFor(material: MaterialItem): EditMaterialInput {
  return {
    name: material.name,
    quantity: material.quantity,
    unit: material.unit,
    activityId: material.activityId ?? null,
    estimatedCost: material.estimatedCost ?? null,
    supplier: material.supplier ?? '',
  };
}

interface MaterialDrawerProps {
  projectId: string;
  /** Con un material es edición; sin él, alta. */
  material?: MaterialItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Alta y edición de un material en el mismo drawer: los seis campos son los
 * mismos, y dos formularios aparte son dos lugares donde un campo nuevo se
 * olvida. Al editar no hay campo de estado: cambia por el botón de paso
 * siguiente, no corrigiendo el material.
 *
 * El drawer vive en la página y no en cada fila: una lista de cincuenta
 * materiales no necesita cincuenta paneles montados.
 */
export function MaterialDrawer({ projectId, material, open, onOpenChange }: MaterialDrawerProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(material);
  const createMaterial = useCreateMaterial(projectId);
  const editMaterial = useEditMaterial(projectId);
  const mutation = isEdit ? editMaterial : createMaterial;
  const { data: activitiesData } = useAllActivities(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<EditMaterialInput>({
    resolver: zodResolver(editMaterialSchema),
    // Con `values` el form se recarga solo cuando se abre otro material.
    values: material ? valuesFor(material) : (EMPTY_VALUES as EditMaterialInput),
  });

  const locked = isApiError(mutation.error) && mutation.error.code === 'MATERIAL_LOCKED';

  function close() {
    // Un error de este intento no tiene que reaparecer en la próxima apertura.
    createMaterial.reset();
    editMaterial.reset();
    onOpenChange(false);
    if (!isEdit) reset();
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
      title={isEdit ? t('material.list.editTitle') : t('material.list.newTitle')}
      fieldCount={6}
      submitLabel={isEdit ? t('material.list.editSubmit') : t('material.list.newSubmit')}
      isSubmitting={mutation.isPending}
      // Al editar, guardar queda apagado hasta que haya algo que guardar — y
      // también después de un bloqueo: reintentar devolvería lo mismo.
      isDirty={isEdit ? isDirty && !locked : undefined}
      error={mutation.error}
      errorActions={
        locked ? (
          <Button type="button" size="sm" variant="outline" onClick={close}>
            {t('material.list.lockedClose')}
          </Button>
        ) : undefined
      }
      onSubmit={handleSubmit((values) => {
        if (material) {
          editMaterial.mutate(
            { materialId: material.id, payload: values },
            { onSuccess: close },
          );
          return;
        }
        createMaterial.mutate(
          {
            ...values,
            status: 'pendiente',
            estimatedCost: values.estimatedCost ?? undefined,
            supplier: values.supplier || undefined,
          },
          { onSuccess: close },
        );
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="material-name">{t('material.fields.name')}</Label>
          <Input id="material-name" aria-invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="material-quantity">{t('material.fields.quantity')}</Label>
          <Input
            id="material-quantity"
            inputMode="decimal"
            aria-invalid={Boolean(errors.quantity)}
            {...register('quantity', { valueAsNumber: true })}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="material-unit">{t('material.fields.unit')}</Label>
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="material-unit" aria-invalid={Boolean(errors.unit)}>
                  <SelectValue placeholder={t('material.fields.unitPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {t(`material.unit.${unit}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="material-activity">{t('material.fields.activity')}</Label>
          <Controller
            control={control}
            name="activityId"
            render={({ field }) => (
              <Select
                value={field.value ?? undefined}
                onValueChange={(value) => field.onChange(value === NO_ACTIVITY ? null : value)}
              >
                <SelectTrigger id="material-activity">
                  <SelectValue placeholder={t('material.fields.activityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {/* Sin esta opción, una tarea cargada por error no se podía sacar. */}
                  {isEdit && (
                    <SelectItem value={NO_ACTIVITY}>{t('material.fields.activityPlaceholder')}</SelectItem>
                  )}
                  {(activitiesData?.activities ?? []).map((activity) => (
                    <SelectItem key={activity.id} value={activity.id}>
                      {activity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="material-cost">{t('material.fields.estimatedCost')}</Label>
          <Input
            id="material-cost"
            inputMode="decimal"
            aria-invalid={Boolean(errors.estimatedCost)}
            {...register('estimatedCost', {
              // Vacío = "sacar el costo": `null` lo borra en la API, `undefined` lo dejaría igual.
              setValueAs: (value) => (value === '' || value == null ? null : Number(value)),
            })}
          />
          {errors.estimatedCost && (
            <p className="text-sm text-destructive">{errors.estimatedCost.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="material-supplier">{t('material.fields.supplier')}</Label>
          <Input id="material-supplier" {...register('supplier')} />
        </div>
      </div>
    </FormDrawer>
  );
}
