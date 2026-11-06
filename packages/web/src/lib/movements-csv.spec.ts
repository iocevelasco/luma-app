import { describe, expect, it } from 'vitest';
import type { Expense, Payment } from '@luma/shared';
import { buildExpensesCsv, buildMovementsCsv, buildPaymentsCsv } from './movements-csv';

const number = (value: number) => String(value).replace('.', ',');

describe('buildMovementsCsv', () => {
  it('empieza con BOM, usa ; y CRLF, y entrecomilla lo que trae el separador o comillas', () => {
    const csv = buildMovementsCsv(['a', 'b'], [['x;y', 'dijo "hola"']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿a;b\r\n"x;y";"dijo ""hola"""\r\n');
  });

  it('neutraliza lo que Excel tomaría por una fórmula', () => {
    expect(buildMovementsCsv(['a'], [['=SUM(A1)']])).toContain("'=SUM(A1)");
  });
});

describe('buildExpensesCsv', () => {
  const labels = {
    number,
    header: {
      date: 'Fecha', description: 'Descripción', category: 'Categoría', method: 'Método', provider: 'Proveedor',
      activity: 'Actividad', amount: 'Importe', currency: 'Moneda', originalAmount: 'Importe original',
      originalCurrency: 'Moneda original', rate: 'Cotización', notes: 'Notas',
    },
    category: () => 'Materiales',
    method: (method: string) => method,
  };

  it('lleva el importe de la obra y el original con su cotización', () => {
    const expense = {
      spentOn: '2026-10-21', description: 'Cemento', category: 'material', amount: 100, currency: 'EUR',
      exchangeRate: 1.1, amountInProjectCurrency: 110, providerName: 'Sol',
    } as Expense;
    const lines = buildExpensesCsv([expense], 'USD', labels).split('\r\n');
    expect(lines[0]).toContain('Importe original');
    expect(lines[1]).toBe('2026-10-21;Cemento;Materiales;;Sol;;110;USD;100;EUR;1,1;');
  });
});

describe('buildPaymentsCsv', () => {
  it('dice "A cuenta" cuando no hay cuota y deja vacío lo que no se cargó', () => {
    const payment = {
      paidOn: '2026-09-26', method: 'zelle', amount: 3000, currency: 'USD', exchangeRate: 1, amountInProjectCurrency: 3000,
    } as Payment;
    const csv = buildPaymentsCsv([payment], 'USD', {
      number,
      header: {
        date: 'Fecha', concept: 'Concepto', method: 'Forma de pago', reference: 'Referencia', amount: 'Importe',
        currency: 'Moneda', originalAmount: 'Importe original', originalCurrency: 'Moneda original', rate: 'Cotización',
        notes: 'Notas',
      },
      onAccount: 'A cuenta',
      method: (method) => method,
    });
    expect(csv.split('\r\n')[1]).toBe('2026-09-26;A cuenta;zelle;;3000;USD;3000;USD;1;');
  });
});
