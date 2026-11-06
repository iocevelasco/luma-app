/**
 * Inventario de una obra: lo que hay físicamente en el patio. Cuelga de
 * `Project`. Compras (`MaterialItem`) dice qué se pidió y qué llegó; el
 * inventario dice cuánto queda y adónde fue el resto.
 *
 * El stock no se guarda: se recalcula sumando el kardex (`StockMovement`),
 * que sólo se agrega, nunca se edita ni se borra.
 */

import type { MaterialUnit } from './material.js';

/**
 * - `compra`: entra solo cuando un material de Compras llega a obra.
 * - `devolucion`: material que salió a un frente y volvió al patio.
 * - `consumo`: se entregó a un frente de trabajo.
 * - `merma`: roto, fraguado, vencido o extraviado. Pide motivo y responsable.
 */
export const STOCK_MOVEMENT_KINDS = ['compra', 'devolucion', 'consumo', 'merma'] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/** Los que una persona registra a mano. `compra` la genera el sistema. */
export const MANUAL_STOCK_MOVEMENT_KINDS = ['devolucion', 'consumo', 'merma'] as const;
export type ManualStockMovementKind = (typeof MANUAL_STOCK_MOVEMENT_KINDS)[number];

export type StockLevel = 'ok' | 'low' | 'out';

/** Una línea del kardex. */
export interface StockMovement {
  id: string;
  projectId: string;
  itemKey: string;
  name: string;
  unit: MaterialUnit;
  kind: StockMovementKind;
  quantity: number;
  /** La tarea (partida) a la que fue el material, si se eligió una. */
  activityId: string | null;
  activityName?: string;
  /** Zona o frente escrito a mano ("Losa nivel 2"). */
  destination?: string;
  /** Persona física que retira o recibe, por nombre ("Maestro Pedro / Albañilería"). */
  receiver?: string;
  /** Sólo en `merma`. */
  reason?: string;
  note?: string;
  /** El material de Compras que originó la entrada, si es una `compra`. */
  materialId: string | null;
  /** Cuándo pasó físicamente; puede ser anterior a cuando se cargó. */
  occurredAt: string;
  /** Quien lo registró en Luma. */
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

/** Una línea del stock actual, ya resuelta por la API. */
export interface StockItem {
  itemKey: string;
  name: string;
  unit: MaterialUnit;
  /** Lo que hay hoy en el patio. */
  stock: number;
  /** Entradas acumuladas (compras y devoluciones). */
  received: number;
  consumed: number;
  wasted: number;
  level: StockLevel;
  lastMovementAt: string;
}

export interface StockListResponse {
  items: StockItem[];
}

export interface StockMovementListResponse {
  movements: StockMovement[];
}

export interface StockMovementResponse {
  movement: StockMovement;
}
