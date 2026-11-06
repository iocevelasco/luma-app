import type {
  DepositLine,
  DepositMovementKind,
  SavingsLine,
  StockItem,
  StockLevel,
  StockMovementKind,
} from '../types/inventory.js';
import { roundMoney } from './money.js';
import { supplierKey } from './material.js';

/**
 * Con qué identifica el inventario "el mismo material". No hay catálogo: lo
 * que se compró como "Cemento" en bolsas y lo que se consume como "cemento "
 * es una sola línea de stock. La unidad cuenta, porque arena en m³ y arena en
 * kg no se pueden sumar.
 */
export function stockItemKey(name: string, unit: string): string {
  return `${supplierKey(name)}|${unit}`;
}

/** Sumar o restar del patio. Es la única fuente de la dirección de cada tipo. */
export function stockDirection(kind: StockMovementKind): 'in' | 'out' {
  switch (kind) {
    case 'compra':
    case 'devolucion':
    case 'importacion':
    case 'deposito_ingreso':
      return 'in';
    default:
      return 'out';
  }
}

/**
 * Por debajo de esta fracción de lo que entró, el stock se marca como "por
 * agotarse". Es una regla y no un campo: no hay un mínimo que cargar por
 * material, y nada derivado se guarda.
 */
export const LOW_STOCK_RATIO = 0.2;

/** Un movimiento, con lo mínimo que hace falta para sumarlo. */
export interface StockLedgerEntry {
  itemKey: string;
  name: string;
  unit: StockItem['unit'];
  kind: StockMovementKind;
  quantity: number;
  occurredAt: string;
}

/** Cuatro decimales, como el mínimo de una cantidad: 0.1 + 0.2 no puede dejar 0.30000000000000004. */
const roundQuantity = (value: number) => Math.round(value * 10_000) / 10_000;

export function stockLevel(item: { stock: number; received: number }): StockLevel {
  if (item.stock <= 0) return 'out';
  return item.stock <= item.received * LOW_STOCK_RATIO ? 'low' : 'ok';
}

/**
 * El stock actual de cada material, recalculado desde el kardex. La API lo usa
 * para responder y para frenar una salida que dejaría el stock en negativo; la
 * UI muestra lo que la API resolvió.
 */
export function summarizeStock(entries: readonly StockLedgerEntry[]): StockItem[] {
  const byKey = new Map<string, StockItem>();

  for (const entry of entries) {
    let item = byKey.get(entry.itemKey);
    if (!item) {
      item = {
        itemKey: entry.itemKey,
        name: entry.name,
        unit: entry.unit,
        stock: 0,
        received: 0,
        consumed: 0,
        wasted: 0,
        transferred: 0,
        level: 'out',
        lastMovementAt: entry.occurredAt,
      };
      byKey.set(entry.itemKey, item);
    }
    if (stockDirection(entry.kind) === 'in') item.received += entry.quantity;
    else if (entry.kind === 'consumo') item.consumed += entry.quantity;
    else if (entry.kind === 'desincorporacion') item.transferred += entry.quantity;
    else item.wasted += entry.quantity;
    if (entry.occurredAt > item.lastMovementAt) item.lastMovementAt = entry.occurredAt;
  }

  return [...byKey.values()]
    .map((item) => {
      const received = roundQuantity(item.received);
      const consumed = roundQuantity(item.consumed);
      const wasted = roundQuantity(item.wasted);
      const transferred = roundQuantity(item.transferred);
      const stock = roundQuantity(received - consumed - wasted - transferred);
      return {
        ...item,
        received,
        consumed,
        wasted,
        transferred,
        stock,
        level: stockLevel({ stock, received }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Un movimiento del Depósito, con lo mínimo que hace falta para sumarlo. */
export interface DepositLedgerEntry {
  itemKey: string;
  name: string;
  unit: StockItem['unit'];
  kind: DepositMovementKind;
  quantity: number;
  /** Costo unitario congelado en el movimiento. */
  unitCost: number;
  currency: string;
  /** La obra de origen (ingreso) o de destino (egreso). */
  projectId: string | null;
  occurredAt: string;
}

/** Cada material se lleva por moneda: no hay cotización que promedie un costo en USD con uno en ARS. */
export function depositLineKey(itemKey: string, currency: string): string {
  return `${itemKey}|${currency}`;
}

/** Los movimientos en orden de fecha: el costo y el ahorro dependen de qué pasó antes. */
function chronological(entries: readonly DepositLedgerEntry[]): DepositLedgerEntry[] {
  return [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/**
 * Lo que hay hoy en el Depósito General, recalculado del kardex.
 *
 * El costo de referencia es un **promedio móvil**: lo que entra suma su costo y
 * lo que sale se lleva su parte al costo promedio de ese momento, así el costo
 * unitario es el de lo que **queda** y no el de todo lo que alguna vez entró.
 * Un material que llegó sin costo (0) pesa por cantidad y baja el promedio, a
 * propósito, para no inflar un ahorro que nadie declaró.
 */
export function summarizeDeposit(entries: readonly DepositLedgerEntry[]): DepositLine[] {
  const byKey = new Map<string, DepositLine & { value: number }>();

  for (const entry of chronological(entries)) {
    const lineKey = depositLineKey(entry.itemKey, entry.currency);
    let line = byKey.get(lineKey);
    if (!line) {
      line = {
        lineKey,
        itemKey: entry.itemKey,
        name: entry.name,
        unit: entry.unit,
        currency: entry.currency,
        stock: 0,
        received: 0,
        sent: 0,
        unitCost: 0,
        value: 0,
      };
      byKey.set(lineKey, line);
    }
    if (stockDirection(entry.kind) === 'in') {
      line.received += entry.quantity;
      line.value += entry.quantity * entry.unitCost;
      line.stock += entry.quantity;
    } else {
      const average = line.stock > 0 ? line.value / line.stock : 0;
      line.sent += entry.quantity;
      line.value -= entry.quantity * average;
      line.stock -= entry.quantity;
      if (line.stock <= 0) line.value = 0;
    }
  }

  return [...byKey.values()]
    .map(({ value, ...line }) => {
      const stock = roundQuantity(line.received - line.sent);
      return {
        ...line,
        received: roundQuantity(line.received),
        sent: roundQuantity(line.sent),
        stock,
        unitCost: stock > 0 ? roundMoney(value / line.stock) : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.currency.localeCompare(b.currency));
}

/**
 * Lo reutilizado y lo ahorrado, por obra destino y moneda: lo que cada egreso
 * del Depósito se llevó, a su costo de referencia congelado. Las monedas no se
 * suman entre sí, y tampoco las cantidades: una bolsa y un metro no se suman,
 * así que se cuenta cuántos materiales distintos se reutilizaron (`items`).
 *
 * Si la obra devuelve al Depósito lo que importó, el ahorro de esa parte se
 * revierte —al costo con que se contó, no al que se tecleó al devolver—, sin
 * pasarse de lo que esa obra importó: lo que una obra manda de su propia compra
 * no resta ahorro. La devolución sólo revierte si va en la misma moneda.
 */
export function summarizeSavings(entries: readonly DepositLedgerEntry[]): SavingsLine[] {
  // Por obra, moneda y material: cuánto se reutilizó y cuánto ahorro lleva.
  const net = new Map<string, { projectId: string | null; currency: string; quantity: number; saved: number }>();

  for (const entry of chronological(entries)) {
    const key = `${entry.projectId ?? ''}|${entry.currency}|${entry.itemKey}`;
    const reused = net.get(key) ?? {
      projectId: entry.projectId,
      currency: entry.currency,
      quantity: 0,
      saved: 0,
    };
    if (entry.kind === 'deposito_egreso') {
      reused.quantity += entry.quantity;
      reused.saved += entry.quantity * entry.unitCost;
    } else if (reused.quantity > 0) {
      const back = Math.min(entry.quantity, reused.quantity);
      reused.saved -= back * (reused.saved / reused.quantity);
      reused.quantity -= back;
    } else {
      continue;
    }
    net.set(key, reused);
  }

  const byProject = new Map<string, SavingsLine>();
  for (const reused of net.values()) {
    const key = `${reused.projectId ?? ''}|${reused.currency}`;
    const line = byProject.get(key) ?? {
      projectId: reused.projectId,
      currency: reused.currency,
      items: 0,
      saved: 0,
    };
    if (reused.quantity > 1e-9) line.items += 1;
    line.saved += reused.saved;
    byProject.set(key, line);
  }

  return [...byProject.values()].map((line) => ({ ...line, saved: Math.max(0, roundMoney(line.saved)) }));
}
