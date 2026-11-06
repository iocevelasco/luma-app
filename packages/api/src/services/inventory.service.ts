import {
  stockItemKey,
  summarizeStock,
  type StockItem,
  type StockLedgerEntry,
} from '@luma/shared';
import { MaterialItem } from '../models/MaterialItem.js';
import { StockMovement, type IStockMovement } from '../models/StockMovement.js';

/** Lo que `summarizeStock` necesita de una línea del kardex. */
export function toLedgerEntry(movement: IStockMovement): StockLedgerEntry {
  return {
    itemKey: movement.itemKey,
    name: movement.name,
    unit: movement.unit,
    kind: movement.kind,
    quantity: movement.quantity,
    occurredAt: movement.occurredAt.toISOString(),
  };
}

const DUPLICATE_KEY = 11000;

/**
 * Cada material de Compras que ya llegó a obra tiene su entrada en el kardex.
 *
 * Se resuelve al leer, no al cambiar el estado del material: así cubre también
 * los materiales que ya estaban en obra antes de que existiera el inventario, y
 * una falla puntual se repara sola en la próxima lectura. Es idempotente —el
 * índice único de `material` frena el duplicado aunque dos requests corran a
 * la vez— y sólo escribe hechos que ya ocurrieron.
 *
 * Una entrada ya registrada no se revierte si el material vuelve a un estado
 * anterior: el kardex es historia, no un espejo de Compras.
 */
export async function ensurePurchaseEntries(projectId: unknown): Promise<void> {
  const arrived = await MaterialItem.find({ project: projectId, status: 'en_obra' });
  if (arrived.length === 0) return;

  const registered = new Set(
    (await StockMovement.find({ project: projectId, kind: 'compra' }).select('material')).map(
      (movement) => String(movement.material),
    ),
  );
  const missing = arrived.filter((material) => !registered.has(String(material._id)));
  if (missing.length === 0) return;

  try {
    await StockMovement.insertMany(
      missing.map((material) => ({
        project: projectId,
        itemKey: stockItemKey(material.name, material.unit),
        name: material.name,
        unit: material.unit,
        kind: 'compra',
        quantity: material.quantity,
        material: material._id,
        occurredAt: material.statusChangedAt ?? material.updatedAt,
        createdBy: material.statusChangedBy ?? material.createdBy,
      })),
      { ordered: false },
    );
  } catch (error) {
    // Otro request la registró entre la lectura y la escritura: es lo esperado.
    const code = (error as { code?: number }).code;
    const writeErrors = (error as { writeErrors?: { code?: number }[] }).writeErrors;
    const onlyDuplicates =
      code === DUPLICATE_KEY || (writeErrors?.length && writeErrors.every((e) => e.code === DUPLICATE_KEY));
    if (!onlyDuplicates) throw error;
  }
}

/** El stock actual de la obra, recalculado desde todo su kardex. */
export async function currentStock(projectId: unknown): Promise<StockItem[]> {
  await ensurePurchaseEntries(projectId);
  const movements = await StockMovement.find({ project: projectId });
  return summarizeStock(movements.map(toLedgerEntry));
}
