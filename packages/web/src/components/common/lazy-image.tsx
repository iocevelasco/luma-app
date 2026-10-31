import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src: string;
  alt: string;
  /** Qué mostrar si la imagen no carga (URL vencida, archivo borrado). */
  fallback?: ReactNode;
}

/**
 * Imagen con carga diferida y un esqueleto hasta que llega. `loading="lazy"`
 * hace que el navegador no la pida hasta que está por verse, y el esqueleto
 * reserva el lugar: sin él, el cuadro aparece vacío y después "salta".
 *
 * El contenedor es el que da el tamaño (`className`); la imagen lo llena.
 */
export function LazyImage({ src, alt, fallback, className, ...props }: LazyImageProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const ref = useRef<HTMLImageElement>(null);

  // Otra imagen, otro esqueleto. Una ya en caché puede estar completa antes de
  // que React enganche `onLoad`: se mira al montar para no dejarla tapada.
  useEffect(() => {
    const img = ref.current;
    setState(img?.complete && img.naturalWidth > 0 ? 'loaded' : 'loading');
  }, [src]);

  if (state === 'failed') return <>{fallback}</>;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
        className={cn(
          'size-full object-contain transition-opacity duration-200',
          state === 'loaded' ? 'opacity-100' : 'opacity-0',
        )}
        {...props}
      />
    </div>
  );
}
