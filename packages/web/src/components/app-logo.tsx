import { useTranslation } from 'react-i18next';
import { BranchLumaLogo } from '@/components/branch-luma-logo';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Sólo el isotipo (el triángulo), sin el nombre. */
  isotypeOnly?: boolean;
}

/** Alto del logo; el ancho sale de su proporción. */
const sizes = {
  sm: 'h-5',
  md: 'h-7',
  lg: 'h-10',
  xl: 'h-14',
};

/**
 * Marca de la aplicación. Header, auth, plataforma y la página legal la
 * consumen desde este único lugar. Hereda el color del texto de donde esté
 * (`currentColor`), así sirve sobre el chrome oscuro y sobre superficies claras.
 */
export function AppLogo({ size = 'md', className, isotypeOnly = false }: AppLogoProps) {
  const { t } = useTranslation();

  return (
    <BranchLumaLogo
      title={t('common.appName')}
      isotypeOnly={isotypeOnly}
      className={cn('w-auto shrink-0 select-none', sizes[size], className)}
    />
  );
}
