import type { MaterialItem, MaterialStatus } from '@luma/shared';

/** Las dos pestañas de Compras: lo que falta comprar y lo que ya se compró. */
export type MaterialTab = 'toBuy' | 'bought';

const TO_BUY: ReadonlySet<MaterialStatus> = new Set(['pendiente', 'solicitado']);

export function materialTab(status: MaterialStatus): MaterialTab {
  return TO_BUY.has(status) ? 'toBuy' : 'bought';
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
