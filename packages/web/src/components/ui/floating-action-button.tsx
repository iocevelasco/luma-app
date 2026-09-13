import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FloatingActionOption {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  testId?: string;
}

interface FloatingActionButtonProps {
  onClick?: () => void;
  label: string;
  icon: LucideIcon;
  /**
   * Acciones que acompañan a la principal, a su izquierda y con jerarquía
   * menor (fondo neutro, no primario).
   *
   * No van adentro de un desplegable: un menú cuesta dos toques y sólo se paga
   * cuando esconde muchas opciones. Como botones, las dos o tres formas de
   * crear se ven de una.
   *
   * Son pocas a propósito: dos, tres como mucho. Si una pantalla necesita más,
   * el problema no es el botón.
   */
  options?: FloatingActionOption[];
  /**
   * Esconde la principal y deja sólo las secundarias. Es para la lista vacía:
   * ahí el CTA principal ya está en el centro de la pantalla, pero las
   * secundarias no están en ningún lado, y es justo cuando más sirven.
   */
  hidePrimary?: boolean;
  /** Se apoya en el testid para los E2E de cada vista. */
  testId?: string;
  className?: string;
}

/**
 * Acción principal flotante — sola o acompañada de sus secundarias.
 *
 * Está en TODOS los breakpoints y siempre en el mismo lugar, abajo a la
 * derecha. Si cada pantalla pone su "crear" donde le queda cómodo, hay que
 * buscarlo de nuevo en cada sección; un solo lugar se aprende una vez.
 *
 * El `bottom` cambia con el breakpoint y no es un detalle: abajo de `md` está
 * la barra de navegación fija (4rem), así que el botón se apoya arriba de ella.
 * Entre `md` y `lg` la barra ya no existe pero el botón sí, y ahí vuelve a
 * pegarse al borde. Con un solo valor, o queda tapado por la barra o flota
 * suelto en el medio de la pantalla en tablet.
 */
export function FloatingActionButton({
  onClick,
  label,
  icon: Icon,
  options,
  hidePrimary = false,
  testId,
  className,
}: FloatingActionButtonProps) {
  const boton = 'gap-2 h-14 rounded-full px-5 shadow-lg shadow-black/30';

  return (
    <div
      className={cn(
        'fixed right-4 z-40 flex items-center gap-2',
        // La barra flota: 0.75rem de aire abajo + 4rem de alto + 0.75rem de aire
        // arriba. Con los 5rem de antes el botón se apoyaba encima del borde.
        'bottom-[calc(5.5rem+env(safe-area-inset-bottom))]',
        // De md para arriba ya no hay barra: vuelve al borde.
        'md:bottom-[calc(1rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {options?.map((opt) => {
        const OptIcon = opt.icon;
        return (
          <Button
            key={opt.label}
            // Sin la principal al lado, la secundaria pasa a ser el único botón
            // flotante y se muestra como tal.
            variant={hidePrimary ? 'default' : 'secondary'}
            onClick={opt.onClick}
            data-testid={opt.testId}
            aria-label={opt.label}
            className={boton}
          >
            <OptIcon className="h-5 w-5" />
            {/* En mobile no entran dos labels enteros al lado del principal:
                queda el icono, y el nombre lo dice el aria-label. Sola, la
                secundaria muestra su label en todos los tamaños. */}
            <span className={cn('font-semibold', !hidePrimary && 'hidden sm:inline')}>
              {opt.label}
            </span>
          </Button>
        );
      })}

      {!hidePrimary && (
        <Button onClick={onClick} data-testid={testId} aria-label={label} className={boton}>
          <Icon className="h-5 w-5" />
          <span className="font-semibold">{label}</span>
        </Button>
      )}
    </div>
  );
}
