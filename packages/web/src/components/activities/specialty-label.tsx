import type { ProviderSpecialty } from '@luma/shared';
import { useTranslation } from 'react-i18next';

/**
 * La especialidad de una actividad, o "Sin especialidad" si no la tiene.
 *
 * Es un componente y no una función suelta porque necesita `t`, y existe para
 * que las cinco pantallas que la muestran digan lo mismo con una actividad
 * anterior al cambio (que no la tiene): antes cada una mostraba el área, y
 * dejarlas elegir su propio texto vacío las desincroniza.
 */
export function SpecialtyLabel({ specialty }: { specialty?: ProviderSpecialty | null }) {
  const { t } = useTranslation();
  return (
    <>{specialty ? t(`provider.specialty.${specialty}`) : t('activity.detail.noSpecialty')}</>
  );
}
