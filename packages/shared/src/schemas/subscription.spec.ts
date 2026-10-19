import { describe, expect, it } from 'vitest';
import {
  bolivaresPaymentSchema,
  manualExchangeRateSchema,
  reviewSubscriptionPaymentSchema,
} from './subscription';

const valid = {
  method: 'pago_movil',
  bank: 'Banesco',
  reference: '00123456',
  payerId: 'v-12345678',
  paidOn: '2026-10-19',
  amountBs: 1408.81,
};

describe('bolivaresPaymentSchema', () => {
  it('acepta un pago móvil completo y normaliza la cédula', () => {
    const parsed = bolivaresPaymentSchema.parse(valid);
    expect(parsed.payerId).toBe('V-12345678');
    expect(parsed.activateNow).toBe(false);
  });

  it('acepta RIF con y sin guion', () => {
    expect(bolivaresPaymentSchema.safeParse({ ...valid, payerId: 'J123456789' }).success).toBe(true);
    expect(bolivaresPaymentSchema.safeParse({ ...valid, payerId: 'J-123456789' }).success).toBe(true);
  });

  it('rechaza una referencia con letras o demasiado corta', () => {
    expect(bolivaresPaymentSchema.safeParse({ ...valid, reference: 'ABC123' }).success).toBe(false);
    expect(bolivaresPaymentSchema.safeParse({ ...valid, reference: '123' }).success).toBe(false);
  });

  it('rechaza un método que no es en bolívares', () => {
    expect(bolivaresPaymentSchema.safeParse({ ...valid, method: 'stripe' }).success).toBe(false);
  });

  it('rechaza una fecha que no es YYYY-MM-DD', () => {
    expect(bolivaresPaymentSchema.safeParse({ ...valid, paidOn: '19/10/2026' }).success).toBe(false);
  });
});

describe('reviewSubscriptionPaymentSchema', () => {
  it('aprobar no pide motivo', () => {
    expect(reviewSubscriptionPaymentSchema.safeParse({ decision: 'aprobar' }).success).toBe(true);
  });

  it('rechazar exige un motivo', () => {
    expect(reviewSubscriptionPaymentSchema.safeParse({ decision: 'rechazar' }).success).toBe(false);
    expect(
      reviewSubscriptionPaymentSchema.safeParse({
        decision: 'rechazar',
        reason: 'La referencia no aparece en el banco',
      }).success,
    ).toBe(true);
  });
});

describe('manualExchangeRateSchema', () => {
  it('pide una tasa positiva y su fecha valor', () => {
    expect(manualExchangeRateSchema.safeParse({ usd: 36.5, valueDate: '2026-10-19' }).success).toBe(true);
    expect(manualExchangeRateSchema.safeParse({ usd: 0, valueDate: '2026-10-19' }).success).toBe(false);
  });
});
