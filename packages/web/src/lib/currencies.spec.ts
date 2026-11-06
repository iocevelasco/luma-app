import { describe, expect, it } from 'vitest';
import { currencyChoices } from './currencies';

describe('currencyChoices', () => {
  it('pone la moneda de la obra primero y no repite', () => {
    const choices = currencyChoices('USD');
    expect(choices[0]).toBe('USD');
    expect(choices.filter((code) => code === 'USD')).toHaveLength(1);
  });

  it('suma una moneda fuera de la lista, de la obra o la actual', () => {
    expect(currencyChoices('UYU')).toContain('UYU');
    expect(currencyChoices('ARS', 'CHF')).toContain('CHF');
  });
});
