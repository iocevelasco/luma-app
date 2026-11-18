import { describe, expect, it } from 'vitest';
import { budgetValidationHint } from './budget-validation';

describe('budgetValidationHint', () => {
  it('lista las partidas cuyo nombre supera el máximo, contando desde 1', () => {
    expect(
      budgetValidationHint([
        { code: 'too_big', maximum: 500, path: ['lines', 7, 'name'], message: 'Es demasiado largo' },
        { code: 'too_big', maximum: 500, path: ['lines', 11, 'name'], message: 'Es demasiado largo' },
      ]),
    ).toEqual({ kind: 'nameTooLong', lines: [8, 12], max: 500 });
  });

  it('si el fallo es de otro campo, igual indica qué partida revisar', () => {
    expect(
      budgetValidationHint([{ code: 'too_big', maximum: 20, path: ['lines', 2, 'unit'] }]),
    ).toEqual({ kind: 'lines', lines: [3] });
  });

  it('devuelve null cuando el error no apunta a una partida', () => {
    expect(budgetValidationHint([{ code: 'too_small', path: ['totalAmount'] }])).toBeNull();
  });
});
