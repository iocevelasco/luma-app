import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Loading component for route lazy loading.
 *
 * `inline` para rutas que ya están adentro de un chrome montado (header y barra
 * de navegación fijos). A pantalla completa el fallback empuja el layout y hace
 * saltar la barra en cada navegación.
 */
export function RouteLoading({ inline = false }: { inline?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center', inline ? 'py-16' : 'min-h-screen')}>
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {!inline && <p className="text-sm text-muted-foreground">Cargando...</p>}
      </div>
    </div>
  );
}
