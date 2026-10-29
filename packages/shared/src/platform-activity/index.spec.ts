import { describe, expect, it } from 'vitest';
import {
  MIN_PEOPLE_PER_CELL,
  PLATFORM_ACTIONS,
  actionsOwnedBy,
  emptyActionCounts,
  isCellSuppressed,
  toCell,
} from './index';

describe('isCellSuppressed', () => {
  it('esconde por debajo del umbral, 0 incluido', () => {
    expect(isCellSuppressed(0)).toBe(true);
    expect(isCellSuppressed(MIN_PEOPLE_PER_CELL - 1)).toBe(true);
  });

  it('muestra desde el umbral inclusive', () => {
    expect(MIN_PEOPLE_PER_CELL).toBe(5);
    expect(isCellSuppressed(MIN_PEOPLE_PER_CELL)).toBe(false);
    expect(isCellSuppressed(50)).toBe(false);
  });

  it('acepta otro umbral', () => {
    expect(isCellSuppressed(2, 3)).toBe(true);
    expect(isCellSuppressed(3, 3)).toBe(false);
  });
});

describe('toCell', () => {
  it('suprimida: sin personas ni conteos, ni el total viaja', () => {
    const counts = { ...emptyActionCounts(), expenseRegistered: 40 };
    expect(toCell(4, counts)).toEqual({ suppressed: true, people: null, actions: null });
  });

  it('visible: devuelve personas y conteos tal cual', () => {
    const counts = { ...emptyActionCounts(), expenseRegistered: 40 };
    expect(toCell(5, counts)).toEqual({ suppressed: false, people: 5, actions: counts });
  });
});

describe('acciones', () => {
  it('cada acción tiene un solo rol dueño y el cliente no tiene ninguna', () => {
    expect(actionsOwnedBy('cliente')).toEqual([]);
    expect(actionsOwnedBy('exMiembro')).toEqual([]);
    const owned = (['gerente', 'supervisor', 'contador'] as const).flatMap(actionsOwnedBy);
    expect([...owned].sort()).toEqual([...PLATFORM_ACTIONS].sort());
  });

  it('no hay ninguna acción de montos', () => {
    expect(PLATFORM_ACTIONS.every((action) => !/amount|monto|total/i.test(action))).toBe(true);
  });
});
