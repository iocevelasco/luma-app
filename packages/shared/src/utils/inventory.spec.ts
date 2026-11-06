import { describe, expect, it } from 'vitest';
import {
  summarizeDeposit,
  summarizeSavings,
  stockDirection,
  stockItemKey,
  stockLevel,
  summarizeStock,
  type DepositLedgerEntry,
  type StockLedgerEntry,
} from './inventory.js';

const entry = (over: Partial<StockLedgerEntry>): StockLedgerEntry => ({
  itemKey: 'cemento|bolsa',
  name: 'Cemento',
  unit: 'bolsa',
  kind: 'compra',
  quantity: 10,
  occurredAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

describe('stockItemKey', () => {
  it('"Cemento", " cemento " y "CEMENTO" son la misma línea de stock', () => {
    expect(stockItemKey('Cemento', 'bolsa')).toBe(stockItemKey('  cemento ', 'bolsa'));
    expect(stockItemKey('Cemento', 'bolsa')).toBe(stockItemKey('CEMENTO', 'bolsa'));
  });

  it('ignora tildes y espacios repetidos', () => {
    expect(stockItemKey('Cabilla  3/8 ñandú', 'un')).toBe(stockItemKey('cabilla 3/8 nandu', 'un'));
  });

  it('la misma palabra en otra unidad es otro material', () => {
    expect(stockItemKey('Arena', 'm3')).not.toBe(stockItemKey('Arena', 'kg'));
  });
});

describe('stockDirection', () => {
  it('compra y devolución suman; consumo y merma restan', () => {
    expect(stockDirection('compra')).toBe('in');
    expect(stockDirection('devolucion')).toBe('in');
    expect(stockDirection('consumo')).toBe('out');
    expect(stockDirection('merma')).toBe('out');
  });
});

describe('summarizeStock', () => {
  it('stock = entradas menos salidas, con el desglose de cada una', () => {
    const [item] = summarizeStock([
      entry({ kind: 'compra', quantity: 40 }),
      entry({ kind: 'consumo', quantity: 15 }),
      entry({ kind: 'merma', quantity: 2 }),
      entry({ kind: 'devolucion', quantity: 3 }),
    ]);
    expect(item).toMatchObject({ stock: 26, received: 43, consumed: 15, wasted: 2 });
  });

  it('agrupa por itemKey y ordena por nombre', () => {
    const items = summarizeStock([
      entry({ itemKey: 'pintura|l', name: 'Pintura', unit: 'l', quantity: 5 }),
      entry({ quantity: 8 }),
      entry({ kind: 'consumo', quantity: 3 }),
    ]);
    expect(items.map((i) => i.name)).toEqual(['Cemento', 'Pintura']);
    expect(items[0]!.stock).toBe(5);
  });

  it('no arrastra el error de los decimales', () => {
    const [item] = summarizeStock([
      entry({ quantity: 0.3 }),
      entry({ kind: 'consumo', quantity: 0.1 }),
      entry({ kind: 'consumo', quantity: 0.2 }),
    ]);
    expect(item!.stock).toBe(0);
  });

  it('lastMovementAt es el movimiento más reciente', () => {
    const [item] = summarizeStock([
      entry({ occurredAt: '2026-11-03T10:00:00.000Z' }),
      entry({ kind: 'consumo', quantity: 1, occurredAt: '2026-11-05T10:00:00.000Z' }),
      entry({ occurredAt: '2026-11-01T10:00:00.000Z' }),
    ]);
    expect(item!.lastMovementAt).toBe('2026-11-05T10:00:00.000Z');
  });

  it('sin movimientos no hay ítems', () => {
    expect(summarizeStock([])).toEqual([]);
  });
});

describe('stockLevel', () => {
  it('sin nada en patio está agotado', () => {
    expect(stockLevel({ stock: 0, received: 40 })).toBe('out');
  });

  it('con el 20% o menos de lo que entró está por agotarse', () => {
    expect(stockLevel({ stock: 8, received: 40 })).toBe('low');
    expect(stockLevel({ stock: 9, received: 40 })).toBe('ok');
  });
});

describe('traspasos al Depósito en el stock de la obra', () => {
  it('lo desincorporado resta del patio y se cuenta aparte; lo importado suma', () => {
    const [item] = summarizeStock([
      entry({ kind: 'compra', quantity: 40 }),
      entry({ kind: 'desincorporacion', quantity: 10 }),
      entry({ kind: 'importacion', quantity: 5 }),
    ]);
    expect(item).toMatchObject({ stock: 35, received: 45, transferred: 10 });
  });

  it('las direcciones de los cuatro tipos nuevos', () => {
    expect(stockDirection('importacion')).toBe('in');
    expect(stockDirection('deposito_ingreso')).toBe('in');
    expect(stockDirection('desincorporacion')).toBe('out');
    expect(stockDirection('deposito_egreso')).toBe('out');
  });
});

const dep = (over: Partial<DepositLedgerEntry>): DepositLedgerEntry => ({
  itemKey: 'cemento|bolsa',
  name: 'Cemento',
  unit: 'bolsa',
  kind: 'deposito_ingreso',
  quantity: 10,
  unitCost: 9,
  currency: 'USD',
  projectId: 'obra-a',
  occurredAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

describe('summarizeDeposit', () => {
  it('stock = ingresos menos egresos, con el costo promedio de lo que entró', () => {
    const [line] = summarizeDeposit([
      dep({ quantity: 10, unitCost: 9 }),
      dep({ quantity: 30, unitCost: 11 }),
      dep({ kind: 'deposito_egreso', quantity: 15, unitCost: 10.5, projectId: 'obra-b' }),
    ]);
    expect(line).toMatchObject({ stock: 25, received: 40, sent: 15, unitCost: 10.5 });
  });

  it('el mismo material en otra moneda es otra línea: no se promedian monedas', () => {
    const lines = summarizeDeposit([dep({ currency: 'USD' }), dep({ currency: 'ARS', unitCost: 9000 })]);
    expect(lines.map((l) => l.currency).sort()).toEqual(['ARS', 'USD']);
  });

  it('un costo desconocido (0) pesa por cantidad en el promedio', () => {
    const [line] = summarizeDeposit([dep({ quantity: 10, unitCost: 0 }), dep({ quantity: 10, unitCost: 10 })]);
    expect(line!.unitCost).toBe(5);
  });

  it('sin movimientos no hay líneas', () => {
    expect(summarizeDeposit([])).toEqual([]);
  });
});

describe('summarizeSavings', () => {
  it('suma cantidad por costo congelado, por obra destino y moneda', () => {
    const savings = summarizeSavings([
      dep({ kind: 'deposito_egreso', quantity: 40, unitCost: 9, projectId: 'obra-b' }),
      dep({ kind: 'deposito_egreso', quantity: 10, unitCost: 9, projectId: 'obra-b' }),
      dep({ kind: 'deposito_egreso', quantity: 2, unitCost: 100, currency: 'ARS', projectId: 'obra-b' }),
      dep({ kind: 'deposito_ingreso', quantity: 99 }),
    ]);
    expect(savings).toEqual(
      expect.arrayContaining([
        { projectId: 'obra-b', currency: 'USD', items: 1, saved: 450 },
        { projectId: 'obra-b', currency: 'ARS', items: 1, saved: 200 },
      ]),
    );
    expect(savings).toHaveLength(2);
  });
});
