import { describe, expect, it } from 'vitest';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_METHODS } from '../types/payment.js';
import { createExpenseSchema, createPaymentSchema, paymentMethodSchema } from './payment.js';

const expense = {
  amount: 100,
  currency: 'USD',
  exchangeRate: 1,
  category: 'material',
  description: 'Cemento',
  spentOn: '2026-11-03',
};

describe('métodos de pago', () => {
  it('el schema y la lista del tipo ofrecen los mismos valores', () => {
    expect([...paymentMethodSchema.options].sort()).toEqual([...PAYMENT_METHODS].sort());
  });

  it('acepta los métodos nuevos', () => {
    for (const method of ['zelle', 'binance', 'pago_movil', 'transferencia_eur', 'transferencia_ves', 'transferencia_usd']) {
      expect(paymentMethodSchema.safeParse(method).success, method).toBe(true);
    }
  });

  it('conserva «transferencia» para lo ya cargado pero no la ofrece', () => {
    expect(paymentMethodSchema.safeParse('transferencia').success).toBe(true);
    expect(PAYMENT_METHOD_OPTIONS).not.toContain('transferencia');
  });

  it('el método de un gasto es opcional', () => {
    expect(createExpenseSchema.safeParse(expense).success).toBe(true);
    expect(createExpenseSchema.safeParse({ ...expense, method: 'zelle' }).success).toBe(true);
    expect(createExpenseSchema.safeParse({ ...expense, method: 'bitcoin' }).success).toBe(false);
  });

  it('el método de un cobro sigue siendo obligatorio', () => {
    const payment = { amount: 100, currency: 'USD', exchangeRate: 1, paidOn: '2026-11-03' };
    expect(createPaymentSchema.safeParse(payment).success).toBe(false);
    expect(createPaymentSchema.safeParse({ ...payment, method: 'binance' }).success).toBe(true);
  });
});
