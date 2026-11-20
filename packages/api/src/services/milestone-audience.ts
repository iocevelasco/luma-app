import type { Capability } from '@luma/shared';

/**
 * Qué hitos ve alguien en una obra. **No es un permiso sino parte de la
 * consulta**: `milestone.read` lo tienen todos los roles, y lo que cambia es
 * cuántas filas salen. Quien no reporta hitos (el cliente) ve sólo los de
 * audiencia `cliente`.
 *
 * Un solo lugar para el listado de hitos y el feed de calendario: si fueran
 * dos, una reunión interna terminaría en el calendario del cliente.
 */
export function milestoneAudienceFilter(can: (capability: Capability) => boolean): {
  audience?: 'cliente';
} {
  return can('milestone.report') ? {} : { audience: 'cliente' };
}
