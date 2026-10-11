import { describe, expect, it } from 'vitest';
import { formatMoney } from './format-money';

describe('formatMoney', () => {
  it('formatea un monto con una moneda ISO válida', () => {
    expect(formatMoney(1234.5, 'ARS', 'es-AR')).toContain('1.234,50');
  });

  it('cae al fallback "código número" con una moneda no ISO', () => {
    expect(formatMoney(1234.5, 'pesos', 'es-AR')).toBe('pesos 1234.50');
  });

  it('formatea cero sin romper', () => {
    expect(() => formatMoney(0, 'ARS', 'es-AR')).not.toThrow();
  });
});
