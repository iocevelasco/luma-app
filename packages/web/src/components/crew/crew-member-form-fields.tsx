import type { ReactNode } from 'react';
import type { CreateCrewMemberInput, CrewMemberKind } from '@luma/shared';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PROVIDER_SPECIALTIES } from '@/components/providers/provider-form-fields';
import { Checkbox } from '@/components/ui/checkbox';
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

const CREW_KINDS: CrewMemberKind[] = ['persona', 'equipo'];

/** Campos del alta y la edición de un empleado, compartidos entre las dos. */
export function CrewMemberFormFields({
  idPrefix,
  register,
  control,
  errors,
  nameAddon,
}: {
  idPrefix: string;
  register: UseFormRegister<CreateCrewMemberInput>;
  control: Control<CreateCrewMemberInput>;
  errors: FieldErrors<CreateCrewMemberInput>;
  /** Va pegado abajo del nombre: las sugerencias de la Empresa mientras se tipea. */
  nameAddon?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('crew.fields.name')}</Label>
        {/* Sin autocompletar del browser: tapaba las sugerencias de la Empresa. */}
        <Input id={`${idPrefix}-name`} autoComplete="off" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        {nameAddon}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-kind`}>{t('crew.fields.kind')}</Label>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-kind`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREW_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`crew.kind.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-specialty`}>{t('crew.fields.specialty')}</Label>
          <Controller
            control={control}
            name="specialty"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-specialty`}>
                  <SelectValue placeholder={t('crew.fields.specialtyPlaceholder')} />
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
      </div>

      <div className="flex flex-col gap-2">
        {/* Sin teléfono no se puede llamar al que faltó, que es el motivo de
            ser de la pantalla de asistencia. */}
        <Label htmlFor={`${idPrefix}-phone`}>{t('crew.fields.phone')}</Label>
        <Input id={`${idPrefix}-phone`} type="tel" {...register('phone')} />
        {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>

      <Controller
        control={control}
        name="isLead"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={field.value} onCheckedChange={(next) => field.onChange(next === true)} />
            {t('crew.fields.isLead')}
          </label>
        )}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>{t('provider.fields.notes')}</Label>
        <Textarea id={`${idPrefix}-notes`} rows={3} {...register('notes')} />
      </div>
    </>
  );
}
