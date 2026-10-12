import {
  allowsCustomSpecialty,
  type CreateProviderInput,
  type ProviderSpecialty,
} from '@luma/shared';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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

/** Mismo orden que el enum de `@luma/shared`: primero el catálogo de obra. */
export const PROVIDER_SPECIALTIES: ProviderSpecialty[] = [
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
export function ProviderFormFields({
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
