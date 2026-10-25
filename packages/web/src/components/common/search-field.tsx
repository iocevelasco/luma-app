import type { ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * El buscador del panel. Misma superficie que los tabs y los botones: cuadrado
 * de esquinas suaves (`rounded-md`), fondo blanco (`card`), sin borde y con la
 * sombra suave de las superficies. El foco no se marca con borde sino con el
 * anillo verde, así que `border-transparent!` gana a los estados de borde del
 * campo (hover, "completo") sin esconder el foco.
 *
 * Los demás campos de un formulario conservan su borde: es lo que dice "acá se
 * escribe". Un buscador no es un campo de formulario, es un control de la barra.
 */
export function SearchField({
  className,
  wrapperClassName,
  ...props
}: Omit<ComponentProps<typeof Input>, 'type'> & {
  /** Para el ancho del control: el contenedor es el que ocupa lugar en la barra. */
  wrapperClassName?: string;
}) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        className={cn('rounded-md border-transparent! bg-card pl-9 shadow-surface', className)}
        {...props}
      />
    </div>
  );
}
