import { describe, expect, it } from 'vitest';
import type { Expense } from '@luma/shared';
import { buildExpensesPdf, expensesFileName } from './expenses-pdf';

describe('expensesFileName', () => {
  it('arma un nombre sin espacios ni acentos', () => {
    expect(expensesFileName('Casa Ribera ñ', new Date(2026, 9, 24))).toBe('gastos-casa-ribera-n-2026-10-24.pdf');
  });
});

describe('buildExpensesPdf', () => {
  it('devuelve un PDF', async () => {
    const expense = {
      id: '1',
      category: 'material',
      description: 'Curvas 3/4 60 unidades',
      spentOn: '2026-10-21',
      amountInProjectCurrency: 37,
    } as Expense;
    const blob = await buildExpensesPdf({
      projectName: 'DIASA',
      expenses: [expense],
      total: 37,
      labels: {
        title: 'Gastos',
        summary: '1 gasto',
        filtered: 'Con filtros aplicados',
        columns: { date: 'Fecha', description: 'Descripción', category: 'Categoría', detail: 'Detalle', amount: 'Importe' },
        total: 'Total',
        generated: 'Generado',
        page: (page, total) => `Página ${page} de ${total}`,
        category: () => 'Materiales',
        method: (method) => method,
        day: (day) => day,
        money: (amount) => `US$ ${amount}`,
      },
    });
    const head = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(head).toBe('%PDF-');
  });
});
