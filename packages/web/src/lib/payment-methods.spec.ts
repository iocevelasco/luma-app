import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import { sortPaymentMethods } from './payment-methods';

const ES: Record<PaymentMethod, string> = {
  transferencia: 'Transferencia',
  transferencia_ves: 'Transferencia en bolívares',
  transferencia_usd: 'Transferencia en dólares',
  transferencia_eur: 'Transferencia en euros',
  pago_movil: 'Pago móvil',
  zelle: 'Zelle',
  binance: 'Binance',
  tarjeta_debito: 'Tarjeta de débito',
  tarjeta_credito: 'Tarjeta de crédito',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  otro: 'Otro',
};

describe('sortPaymentMethods', () => {
  it('ordena por la etiqueta y deja «Otro» al final', () => {
    const sorted = sortPaymentMethods(PAYMENT_METHOD_OPTIONS, (m) => ES[m], 'es-ES');
    expect(sorted.map((m) => ES[m])).toEqual([
      'Binance',
      'Cheque',
      'Efectivo',
      'Pago móvil',
      'Tarjeta de crédito',
      'Tarjeta de débito',
      'Transferencia en bolívares',
      'Transferencia en dólares',
      'Transferencia en euros',
      'Zelle',
      'Otro',
    ]);
  });

  it('no muta la lista que recibe', () => {
    const original = [...PAYMENT_METHOD_OPTIONS];
    sortPaymentMethods(PAYMENT_METHOD_OPTIONS, (m) => ES[m], 'es-ES');
    expect([...PAYMENT_METHOD_OPTIONS]).toEqual(original);
  });
});
