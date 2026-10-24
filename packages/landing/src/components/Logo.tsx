import { useTranslation } from 'react-i18next';
import { BranchLumaLogo } from './BranchLumaLogo';

/**
 * Marca de Luma. Hereda el color del texto (`text-foreground`), así funciona
 * sobre el fondo oscuro del nav y del footer.
 */
export function Logo({ className = '' }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <BranchLumaLogo
      title={t('brand')}
      className={`h-10 w-auto text-foreground ${className}`}
    />
  );
}
