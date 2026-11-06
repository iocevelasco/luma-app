import {
  stockItemKey,
  summarizeStock,
  type StockItem,
  type StockLedgerEntry,
} from '@luma/shared';
import { MaterialItem, type IMaterialItem } from '../models/MaterialItem.js';
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
 * La entrada al patio de cada material de Compras que llegó a obra: una fila
 * `compra` por material (el índice único de `material` frena el duplicado, aunque
 * dos requests lo intenten a la vez).
 *
 * Se llama **al escribir**, cuando Compras deja un material en `en_obra`
 * (`material.controller.ts`), y es idempotente: repetir el cambio de estado
 * —o reintentarlo si falló— completa lo que faltó. Las lecturas del inventario
 * no escriben. Los materiales que ya estaban en obra antes del inventario los
 * cubre `backfillPurchaseEntries`.
 *
 * Una entrada ya registrada no se revierte si el material vuelve a un estado
 * anterior: el kardex es historia, no un espejo de Compras.
 */
export async function recordPurchaseEntries(
  materials: readonly Pick<
    IMaterialItem,
    '_id' | 'project' | 'name' | 'unit' | 'quantity' | 'status' | 'statusChangedAt' | 'statusChangedBy' | 'createdBy' | 'updatedAt'
  >[],
): Promise<number> {
  const arrived = materials.filter((material) => material.status === 'en_obra');
  if (arrived.length === 0) return 0;

  const registered = new Set(
    (
      await StockMovement.find({
        kind: 'compra',
        material: { $in: arrived.map((material) => material._id) },
      }).select('material')
    ).map((movement) => String(movement.material)),
  );
  const missing = arrived.filter((material) => !registered.has(String(material._id)));
  if (missing.length === 0) return 0;

  try {
    await StockMovement.insertMany(
      missing.map((material) => ({
        project: material.project,
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
  return missing.length;
}

const BACKFILL_BATCH = 500;

/**
 * Registra la entrada de los materiales que ya estaban en obra antes de que
 * existiera el inventario (y de cualquiera que se haya escapado). Se corre una
 * vez al desplegar (`pnpm --filter @luma/api stock:backfill`); repetirlo es
 * inofensivo. La fecha y quien la cargó salen del material, o de su última
 * actualización si es anterior al campo `statusChangedAt`.
 */
export async function backfillPurchaseEntries(): Promise<{ materials: number; created: number }> {
  let materials = 0;
  let created = 0;
  let batch: IMaterialItem[] = [];

  const flush = async () => {
    created += await recordPurchaseEntries(batch);
    batch = [];
  };

  for await (const material of MaterialItem.find({ status: 'en_obra' }).cursor()) {
    materials += 1;
    batch.push(material);
    if (batch.length >= BACKFILL_BATCH) await flush();
  }
  await flush();
  return { materials, created };
}

/** El stock actual de la obra, recalculado desde todo su kardex. */
export async function currentStock(projectId: unknown): Promise<StockItem[]> {
  const movements = await StockMovement.find({ project: projectId });
  return summarizeStock(movements.map(toLedgerEntry));
}
