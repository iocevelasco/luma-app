import { describe, expect, it } from 'vitest';
import { roundMoney } from './money.js';

describe('roundMoney', () => {
  it('redondea a 2 decimales', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it('no toca un valor que ya tiene 2 decimales', () => {
    expect(roundMoney(1234.56)).toBe(1234.56);
  });

  it('evita el error de coma flotante clásico', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('acepta cero y enteros', () => {
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(100)).toBe(100);
  });
});
