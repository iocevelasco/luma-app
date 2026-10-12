import type { ReactNode } from 'react';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { cn } from '@/lib/utils';

/**
 * Acción de creación principal de una pantalla, flotando en la esquina
 * inferior derecha.
 *
 * Envuelve al botón que ya existía en vez de reemplazarlo: el botón sigue
 * siendo un `Button` con su texto (un "+" solo es ambiguo cuando hay más de
 * una cosa creable) y sólo cambia dónde está. Uno por pantalla: con dos, ninguno
 * es "el" principal.
 *
 * En mobile, fuera de una obra sube lo que mide la barra inferior de
 * navegación; adentro de una obra esa barra no está (la navegación es la tira
 * de arriba). `safe-area-inset-bottom` evita que el home indicator de iOS lo
 * tape.
 */
export function Fab({ children, className }: { children: ReactNode; className?: string }) {
  const insideProject = Boolean(useCurrentProjectId());

  return (
    <div
      className={cn(
        'fixed right-4 z-30 md:right-8 md:bottom-8 [&_button]:shadow-lg [&_a]:shadow-lg',
        insideProject
          ? 'bottom-[calc(1rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(5rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Fab;
