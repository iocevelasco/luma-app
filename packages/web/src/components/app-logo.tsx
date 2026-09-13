import { cn } from '@/lib/utils';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

/**
 * Marca de la aplicación. Placeholder tipográfico a propósito: cuando haya un
 * logo real, se reemplaza acá y cambia en toda la app — header, auth y landing
 * lo consumen desde este único lugar.
 */
export function AppLogo({ size = 'md', className }: AppLogoProps) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center font-semibold tracking-tight',
        sizes[size],
        className,
      )}
    >
      Luma
    </span>
  );
}
