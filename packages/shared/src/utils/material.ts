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

/**
 * Con qué se compara el nombre de un proveedor para saber si dos son el
 * mismo. "Corralón Sur", " corralon  sur" y "CORRALÓN SUR" son el mismo
 * negocio. Lo usan la lista de compras (para agrupar) y la API (para saber si
 * vincular un texto viejo al directorio cambia algo o sólo lo formaliza).
 */
export function supplierKey(supplier: string | null | undefined): string {
  return (supplier ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
