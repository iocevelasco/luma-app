import { describe, expect, it } from 'vitest';
import {
  createStockMovementSchema,
  importFromDepositSchema,
  sendToDepositSchema,
} from './inventory.js';

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

describe('sendToDepositSchema', () => {
  it('el costo es opcional y por defecto 0', () => {
    const parsed = sendToDepositSchema.safeParse({ itemKey: 'cemento|bolsa', quantity: 5 });
    expect(parsed.success && parsed.data.unitCost).toBe(0);
  });

  it('no acepta cantidad ni costo negativos', () => {
    expect(sendToDepositSchema.safeParse({ itemKey: 'x|un', quantity: -1 }).success).toBe(false);
    expect(sendToDepositSchema.safeParse({ itemKey: 'x|un', quantity: 1, unitCost: -2 }).success).toBe(false);
  });
});

describe('importFromDepositSchema', () => {
  const line = { itemKey: 'cemento|bolsa', currency: 'USD', quantity: 4 };

  it('pide al menos un material', () => {
    expect(importFromDepositSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it('no repite el mismo material en la misma moneda', () => {
    expect(importFromDepositSchema.safeParse({ lines: [line, line] }).success).toBe(false);
    expect(
      importFromDepositSchema.safeParse({ lines: [line, { ...line, currency: 'ARS' }] }).success,
    ).toBe(true);
  });

  it('el flete es opcional y positivo', () => {
    expect(importFromDepositSchema.safeParse({ lines: [line], freight: { amount: 50 } }).success).toBe(true);
    expect(importFromDepositSchema.safeParse({ lines: [line], freight: { amount: 0 } }).success).toBe(false);
  });
});
