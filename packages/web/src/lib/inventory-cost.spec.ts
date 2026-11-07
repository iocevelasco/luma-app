import { describe, expect, it } from 'vitest';
import { suggestUnitCost } from './inventory-cost';

const material = (over: object) => ({
  name: 'Cemento',
  unit: 'bolsa' as const,
  quantity: 40,
  estimatedCost: 360,
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

describe('suggestUnitCost', () => {
  it('es el costo estimado de la compra repartido por su cantidad', () => {
    expect(suggestUnitCost([material({})], 'cemento|bolsa')).toBe(9);
  });

  it('identifica el material como el inventario: nombre normalizado y unidad', () => {
    expect(suggestUnitCost([material({ name: ' CEMENTO ' })], 'cemento|bolsa')).toBe(9);
    expect(suggestUnitCost([material({ unit: 'kg' })], 'cemento|bolsa')).toBeUndefined();
  });

  it('con varias compras toma la más reciente que tenga costo', () => {
    const older = material({ estimatedCost: 200, updatedAt: '2026-10-01T10:00:00.000Z' });
    const newer = material({ estimatedCost: 480 });
    const noCost = material({ estimatedCost: undefined, updatedAt: '2026-11-05T10:00:00.000Z' });
    expect(suggestUnitCost([older, newer, noCost], 'cemento|bolsa')).toBe(12);
  });

  it('sin costo cargado no sugiere nada', () => {
    expect(suggestUnitCost([material({ estimatedCost: undefined })], 'cemento|bolsa')).toBeUndefined();
    expect(suggestUnitCost([], 'cemento|bolsa')).toBeUndefined();
  });
});
