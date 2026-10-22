import { supplierKey, type MaterialItem, type MaterialStatus } from '@luma/shared';

export { supplierKey };

/** Las dos pestañas de Compras: lo que falta comprar y lo que ya se compró. */
export type MaterialTab = 'toBuy' | 'bought';

const TO_BUY: ReadonlySet<MaterialStatus> = new Set(['pendiente', 'solicitado']);

export function materialTab(status: MaterialStatus): MaterialTab {
  return TO_BUY.has(status) ? 'toBuy' : 'bought';
}

/**
 * El paso siguiente de cada material. El camino es lineal —se pide, se
 * compra, llega— y casi todos los cambios de estado son "el que sigue": un
 * botón con el nombre de lo que va a pasar, en vez de un selector con los
 * cuatro estados donde hay que saber cuál elegir. Los demás cambios (volver
 * atrás, corregir) quedan en el menú.
 */
export const NEXT_MATERIAL_STATUS: Partial<Record<MaterialStatus, MaterialStatus>> = {
  pendiente: 'solicitado',
  solicitado: 'comprado',
  comprado: 'en_obra',
};

/** Estado de una casilla que agrupa a otras: la maestra o la de un grupo. */
export type SelectionState = 'none' | 'some' | 'all';

export function selectionState(ids: readonly string[], selected: ReadonlySet<string>): SelectionState {
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return 'none';
  return count === ids.length ? 'all' : 'some';
}

/**
 * Qué se le puede ofrecer a una selección. Sólo lo que vale para TODOS: un
 * "Eliminar" que después falla para la mitad obliga a adivinar cuál era.
 *
 * - `next`: el paso siguiente, si todos están en el mismo estado y hay uno.
 * - `canDelete`: todos siguen editables (la API ya lo resolvió en `editable`).
 * - `locksSome`: alguno sigue editable y un cambio de estado lo bloquearía.
 */
export function bulkActionsFor(selected: readonly MaterialItem[]): {
  next: MaterialStatus | null;
  canDelete: boolean;
  locksSome: boolean;
} {
  if (selected.length === 0) return { next: null, canDelete: false, locksSome: false };
  const first = selected[0]!.status;
  const sameStatus = selected.every((material) => material.status === first);
  return {
    next: sameStatus ? (NEXT_MATERIAL_STATUS[first] ?? null) : null,
    canDelete: selected.every((material) => material.editable),
    locksSome: selected.some((material) => material.editable),
  };
}

export interface ActivityRef {
  name: string;
  /** `YYYY-MM-DD`. */
  startDate: string;
}

export interface ToBuyGroup {
  /** `null` = materiales sin actividad (o con una que ya no existe). */
  activityId: string | null;
  activity: ActivityRef | null;
  items: MaterialItem[];
}

export interface OrganizedMaterials {
  toBuyGroups: ToBuyGroup[];
  /** Lo mismo que `toBuyGroups`, aplanado y en el mismo orden. */
  toBuy: MaterialItem[];
  /** Comprado, falta que llegue. */
  onTheWay: MaterialItem[];
  onSite: MaterialItem[];
  /** `onTheWay` y después `onSite`: el orden de la pestaña "Comprados". */
  bought: MaterialItem[];
}

/**
 * El orden de Compras, en un solo lugar para la página y para la card del
 * resumen de la obra: si cada una ordenara por su cuenta, lo primero de la
 * card no sería lo primero de la lista a la que lleva.
 *
 * Lo que falta comprar va por cuándo lo necesita cada actividad, no por
 * estado: lo que frena el lunes va arriba aunque se haya cargado último. Lo
 * comprado, lo último que cambió primero.
 */
export function organizeMaterials(
  materials: MaterialItem[],
  activityById: ReadonlyMap<string, ActivityRef>,
): OrganizedMaterials {
  const changedAt = (m: MaterialItem) => m.statusChangedAt ?? m.updatedAt;
  const newestFirst = (a: MaterialItem, b: MaterialItem) => changedAt(b).localeCompare(changedAt(a));

  // Por actividad, la que empieza antes primero; sin actividad, al final.
  const byActivity = new Map<string | null, MaterialItem[]>();
  for (const material of materials) {
    if (materialTab(material.status) !== 'toBuy') continue;
    const key = material.activityId && activityById.has(material.activityId) ? material.activityId : null;
    byActivity.set(key, [...(byActivity.get(key) ?? []), material]);
  }
  const toBuyGroups = [...byActivity.entries()]
    .map(([activityId, items]) => ({
      activityId,
      activity: activityId ? activityById.get(activityId)! : null,
      // Lo que nadie pidió todavía, antes que lo ya solicitado.
      items: [...items].sort(
        (a, b) => Number(a.status === 'solicitado') - Number(b.status === 'solicitado'),
      ),
    }))
    .sort((a, b) => {
      if (!a.activity) return 1;
      if (!b.activity) return -1;
      return a.activity.startDate.localeCompare(b.activity.startDate);
    });

  const onTheWay = materials.filter((m) => m.status === 'comprado').sort(newestFirst);
  const onSite = materials.filter((m) => m.status === 'en_obra').sort(newestFirst);

  return {
    toBuyGroups,
    toBuy: toBuyGroups.flatMap((group) => group.items),
    onTheWay,
    onSite,
    bought: [...onTheWay, ...onSite],
  };
}

/** Una línea de la lista de compras que sale en el PDF y en el texto de copiar. */
export interface PurchaseRow {
  id: string;
  name: string;
  quantity: number;
  unit: MaterialItem['unit'];
  /** `null` = sin proveedor. Ya viene con la grafía que se muestra. */
  supplier: string | null;
  /**
   * Va en la lista, pero marcado: en "Por comprar", lo que ya se le encargó
   * al proveedor; en "Comprados", lo que ya llegó a la obra. Lo marcado va
   * último dentro de cada proveedor: arriba queda lo que todavía pide algo.
   */
  tagged: boolean;
}

/** Las dos listas que se exportan: la de compras y la de lo ya comprado. */
export type PurchaseListKind = MaterialTab;

const TAGGED_STATUS: Record<PurchaseListKind, MaterialStatus> = {
  toBuy: 'solicitado',
  bought: 'en_obra',
};

/**
 * A quién se le compra, para mostrar: el proveedor vinculado si hay uno, si no
 * lo escrito a mano. `supplierKey` (en `@luma/shared`) es con qué se compara.
 */
export function supplierName(material: Pick<MaterialItem, 'providerName' | 'supplier'>): string | null {
  const name = material.providerName ?? material.supplier;
  return name?.trim() ? name.trim() : null;
}

/**
 * El proveedor del directorio que se llama igual que lo escrito a mano en un
 * material sin vincular. Es la sugerencia de "Vincular": nunca se vincula
 * solo, porque "JDR" y "JDR Ferretería" pueden ser dos negocios.
 */
export function providerMatchFor<P extends { id: string; name: string }>(
  material: Pick<MaterialItem, 'providerId' | 'supplier'>,
  providers: readonly P[],
): P | null {
  if (material.providerId) return null;
  const key = supplierKey(material.supplier);
  if (!key) return null;
  return providers.find((provider) => supplierKey(provider.name) === key) ?? null;
}

/**
 * La lista de compras, lista para salir a comprar: ordenada por proveedor
 * —se recorre proveedor por proveedor— con "sin proveedor" al final. Dentro
 * de cada uno, lo que nadie pidió todavía antes que lo ya solicitado, y
 * después por nombre.
 *
 * Es UNA sola construcción para el PDF, copiar y compartir: si cada salida
 * armara su lista, las tres terminarían diciendo cosas distintas.
 */
export function buildPurchaseRows(
  toBuy: MaterialItem[],
  locale = 'es',
  kind: PurchaseListKind = 'toBuy',
): PurchaseRow[] {
  // De las grafías de un mismo proveedor se muestra la más repetida. La del
  // directorio gana siempre: es la que alguien cargó con cuidado, y así un
  // material vinculado y uno viejo escrito a mano caen en el mismo grupo.
  const LINKED_WEIGHT = 1_000_000;
  const spellings = new Map<string, Map<string, number>>();
  for (const material of toBuy) {
    const name = supplierName(material);
    const key = supplierKey(name);
    if (!key) continue;
    const label = (name ?? '').replace(/\s+/g, ' ');
    const counts = spellings.get(key) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + (material.providerName ? LINKED_WEIGHT : 1));
    spellings.set(key, counts);
  }
  const labelFor = (key: string): string | null => {
    const counts = spellings.get(key);
    if (!counts) return null;
    // Empate: gana la primera que se cargó (el `Map` conserva ese orden).
    return [...counts.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  };

  return toBuy
    .map((material) => ({
      id: material.id,
      name: material.name,
      quantity: material.quantity,
      unit: material.unit,
      supplier: labelFor(supplierKey(supplierName(material))),
      tagged: material.status === TAGGED_STATUS[kind],
    }))
    .sort((a, b) => {
      if (!a.supplier !== !b.supplier) return a.supplier ? -1 : 1;
      const bySupplier = supplierKey(a.supplier).localeCompare(supplierKey(b.supplier), locale);
      if (bySupplier !== 0) return bySupplier;
      if (a.tagged !== b.tagged) return Number(a.tagged) - Number(b.tagged);
      return a.name.localeCompare(b.name, locale);
    });
}

/** Cuántos proveedores distintos hay en la lista (sin contar "sin proveedor"). */
export function countSuppliers(rows: PurchaseRow[]): number {
  return new Set(rows.filter((row) => row.supplier).map((row) => supplierKey(row.supplier))).size;
}

/** El texto de copiar y compartir: una línea por material, la misma lista que el PDF. */
export function buildPurchaseText(
  rows: PurchaseRow[],
  labels: { unit: (unit: PurchaseRow['unit']) => string; tag: string },
): string {
  return rows
    .map((row) => {
      const supplier = row.supplier ? ` · ${row.supplier}` : '';
      const tag = row.tagged ? ` (${labels.tag})` : '';
      return `- ${row.name}: ${row.quantity} ${labels.unit(row.unit)}${supplier}${tag}`;
    })
    .join('\n');
}
