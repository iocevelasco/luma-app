import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * La única animación de carga de la app: un círculo girando, centrado.
 *
 * Existía de tres maneras —un spinner a pantalla completa con "Cargando...",
 * un esqueleto de tabla y pantallas que no mostraban nada— y la persona no
 * sabía si estaba cargando o roto. Ahora toda espera se ve igual.
 *
 * `fullscreen` es para lo que bloquea toda la app (sesión, ruta perezosa); el
 * resto va dentro del área de contenido y deja el chrome en su lugar.
 */
export function LoadingIndicator({
  fullscreen = false,
  className,
}: {
  fullscreen?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center',
        fullscreen ? 'min-h-screen' : 'min-h-[50dvh]',
        className,
      )}
      data-testid="loading-indicator"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

export default LoadingIndicator;
