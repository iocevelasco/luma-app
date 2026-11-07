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
 * - `desincorporacion`: sale de la obra hacia el Depósito General.
 * - `importacion`: entra desde el Depósito General, a costo $0 para esta obra.
 */
export const PROJECT_STOCK_MOVEMENT_KINDS = [
  'compra',
  'devolucion',
  'consumo',
  'merma',
  'desincorporacion',
  'importacion',
] as const;
export type ProjectStockMovementKind = (typeof PROJECT_STOCK_MOVEMENT_KINDS)[number];

/**
 * El otro lado de un traspaso, en el Depósito General de la Empresa (fila sin
 * obra): `deposito_ingreso` cuando una obra manda material, `deposito_egreso`
 * cuando otra lo importa.
 */
export const DEPOSIT_MOVEMENT_KINDS = ['deposito_ingreso', 'deposito_egreso'] as const;
export type DepositMovementKind = (typeof DEPOSIT_MOVEMENT_KINDS)[number];

export const STOCK_MOVEMENT_KINDS = [
  ...PROJECT_STOCK_MOVEMENT_KINDS,
  ...DEPOSIT_MOVEMENT_KINDS,
] as const;
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
  kind: ProjectStockMovementKind;
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
  /** Lo que se mandó al Depósito General. */
  transferred: number;
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

/** Una línea del Depósito General: un material en una moneda. */
export interface DepositLine {
  /** `itemKey|moneda`: lo que se elige al importar. */
  lineKey: string;
  itemKey: string;
  name: string;
  unit: MaterialUnit;
  currency: string;
  /** Lo que hay hoy en el Depósito. */
  stock: number;
  received: number;
  sent: number;
  /** Costo unitario de referencia: el promedio, por cantidad, de lo que entró. */
  unitCost: number;
}

/** Un movimiento del Depósito, para su historial. */
export interface DepositMovement {
  id: string;
  kind: DepositMovementKind;
  itemKey: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitCost: number;
  currency: string;
  /** La obra que mandó el material (ingreso) o la que lo recibió (egreso). */
  projectId: string | null;
  projectName?: string;
  occurredAt: string;
  createdBy: string;
}

/** Lo reutilizado y lo ahorrado en una obra destino, en una moneda. */
export interface SavingsLine {
  projectId: string | null;
  projectName?: string;
  currency: string;
  /** Cuántos materiales distintos se reutilizaron: las unidades distintas no se suman. */
  items: number;
  /** Cantidad × costo de referencia congelado. Nunca se suma entre monedas. */
  saved: number;
}

export interface DepositResponse {
  lines: DepositLine[];
}

export interface DepositOverviewResponse {
  lines: DepositLine[];
  movements: DepositMovement[];
  savings: SavingsLine[];
}
