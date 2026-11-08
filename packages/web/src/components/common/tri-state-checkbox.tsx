import type { ComponentProps } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Casilla de tres estados para las que agrupan a otras ("Seleccionar todos").
 *
 * Es el `Checkbox` del sistema: el de HeroUI ya dibuja un guion en
 * `indeterminate` y la tilde en `checked`, así que no hace falta nada propio.
 * Se conserva el nombre porque deja claro en el call-site que acepta `'indeterminate'`.
 */
export function TriStateCheckbox(props: ComponentProps<typeof Checkbox>) {
  return <Checkbox {...props} />;
}
