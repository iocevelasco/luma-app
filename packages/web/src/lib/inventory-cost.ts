import { roundMoney, stockItemKey, type MaterialItem } from '@luma/shared';

/**
 * El costo unitario que se le sugiere a quien manda material al Depósito: el
 * costo estimado de la compra de ese material repartido por su cantidad. Es una
 * sugerencia, no un dato: la persona lo confirma o lo corrige.
 *
 * El material se reconoce igual que en el inventario (`stockItemKey`: nombre
 * normalizado y unidad). Con varias compras gana la más reciente que tenga
 * costo. Sin costo cargado —o sin permiso para verlo— no sugiere nada.
 */
export function suggestUnitCost(
  materials: readonly Pick<MaterialItem, 'name' | 'unit' | 'quantity' | 'estimatedCost' | 'updatedAt'>[],
  itemKey: string,
): number | undefined {
  const latest = materials
    .filter(
      (material) =>
        material.estimatedCost !== undefined &&
        material.quantity > 0 &&
        stockItemKey(material.name, material.unit) === itemKey,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  return latest ? roundMoney(latest.estimatedCost! / latest.quantity) : undefined;
}
