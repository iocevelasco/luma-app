import { describe, expect, it } from 'vitest';
import { createStockMovementSchema } from './inventory.js';

const base = { itemKey: 'cemento|bolsa', quantity: 5 };

describe('createStockMovementSchema', () => {
  it('un consumo pide quién lo recibe', () => {
    expect(createStockMovementSchema.safeParse({ ...base, kind: 'consumo' }).success).toBe(false);
    expect(
      createStockMovementSchema.safeParse({ ...base, kind: 'consumo', receiver: 'Pedro' }).success,
    ).toBe(true);
  });

  it('una merma pide motivo y responsable', () => {
    const noReason = createStockMovementSchema.safeParse({ ...base, kind: 'merma', receiver: 'Ana' });
    expect(noReason.success).toBe(false);
    const noWho = createStockMovementSchema.safeParse({ ...base, kind: 'merma', reason: 'Fraguó' });
    expect(noWho.success).toBe(false);
    expect(
      createStockMovementSchema.safeParse({
        ...base,
        kind: 'merma',
        reason: 'Fraguó',
        receiver: 'Ana',
      }).success,
    ).toBe(true);
  });

  it('una devolución no pide nada más', () => {
    expect(createStockMovementSchema.safeParse({ ...base, kind: 'devolucion' }).success).toBe(true);
  });

  it('la compra no se carga a mano', () => {
    expect(
      createStockMovementSchema.safeParse({ ...base, kind: 'compra', receiver: 'x' }).success,
    ).toBe(false);
  });

  it('la cantidad es positiva', () => {
    expect(
      createStockMovementSchema.safeParse({ ...base, quantity: 0, kind: 'devolucion' }).success,
    ).toBe(false);
  });
});
