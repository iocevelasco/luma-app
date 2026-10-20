import type { MaterialItem } from '../types/material.js';

/**
 * Un material se corrige —editar o eliminar— sólo mientras nadie lo movió de
 * Pendiente. En cuanto pasa a Solicitado se asume que estaba bien y queda
 * como registro: cambiarle la cantidad a algo que ya se le encargó a un
 * proveedor hace que la lista deje de coincidir con lo que realmente se pidió.
 *
 * Son DOS condiciones a propósito:
 *
 * - `status === 'pendiente'` sola tiene un agujero: el menú deja volver a
 *   Pendiente, y el material se desbloquearía.
 * - `!statusChangedAt` sola deja editable un material viejo que ya está
 *   Comprado y nunca tuvo fecha de cambio.
 *
 * La API la usa para decidir y para armar `MaterialItem.editable`; la UI lee
 * ese campo y no la vuelve a derivar.
 */
export function isMaterialEditable(material: {
  status: MaterialItem['status'];
  statusChangedAt?: Date | string | null;
}): boolean {
  return material.status === 'pendiente' && !material.statusChangedAt;
}
