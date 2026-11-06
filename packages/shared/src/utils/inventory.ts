import type {
  StockItem,
  StockLevel,
  StockMovementKind,
} from '../types/inventory.js';
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
  return kind === 'compra' || kind === 'devolucion' ? 'in' : 'out';
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
        level: 'out',
        lastMovementAt: entry.occurredAt,
      };
      byKey.set(entry.itemKey, item);
    }
    if (stockDirection(entry.kind) === 'in') item.received += entry.quantity;
    else if (entry.kind === 'consumo') item.consumed += entry.quantity;
    else item.wasted += entry.quantity;
    if (entry.occurredAt > item.lastMovementAt) item.lastMovementAt = entry.occurredAt;
  }

  return [...byKey.values()]
    .map((item) => {
      const received = roundQuantity(item.received);
      const consumed = roundQuantity(item.consumed);
      const wasted = roundQuantity(item.wasted);
      const stock = roundQuantity(received - consumed - wasted);
      return { ...item, received, consumed, wasted, stock, level: stockLevel({ stock, received }) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
