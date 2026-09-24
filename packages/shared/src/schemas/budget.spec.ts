import { describe, expect, it } from 'vitest';
import { createBudgetSchema } from './budget.js';

const validLine = { chapter: 'Demolición', name: 'Retiro de escombros', unit: 'global', total: 100 };

describe('createBudgetSchema', () => {
  it('acepta un presupuesto válido', () => {
    const result = createBudgetSchema.safeParse({ totalAmount: 100, lines: [validLine] });
    expect(result.success).toBe(true);
  });

  it('default de contingencyAmount es 0', () => {
    const result = createBudgetSchema.safeParse({ totalAmount: 100, lines: [validLine] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contingencyAmount).toBe(0);
  });

  it('default de importMode es manual', () => {
    const result = createBudgetSchema.safeParse({ totalAmount: 100, lines: [validLine] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.importMode).toBe('manual');
  });

  it('acepta importMode import con metadata de origen', () => {
    const result = createBudgetSchema.safeParse({
      totalAmount: 100,
      lines: [validLine],
      importMode: 'import',
      sourceFileName: 'presupuesto.xlsx',
      sourceRowCount: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.importMode).toBe('import');
      expect(result.data.sourceFileName).toBe('presupuesto.xlsx');
      expect(result.data.sourceRowCount).toBe(42);
    }
  });

  it('redondea totalAmount, contingencyAmount y el total de cada línea a 2 decimales', () => {
    const result = createBudgetSchema.safeParse({
      totalAmount: 100.005,
      contingencyAmount: 10.001,
      lines: [{ ...validLine, total: 100.005 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalAmount).toBe(100.01);
      expect(result.data.contingencyAmount).toBe(10);
      expect(result.data.lines[0].total).toBe(100.01);
    }
  });

  it('rechaza sin ítems', () => {
    expect(createBudgetSchema.safeParse({ totalAmount: 100, lines: [] }).success).toBe(false);
  });

  it('rechaza totalAmount negativo', () => {
    expect(
      createBudgetSchema.safeParse({ totalAmount: -1, lines: [validLine] }).success,
    ).toBe(false);
  });

  it('rechaza un ítem sin capítulo', () => {
    const { chapter: _chapter, ...rest } = validLine;
    expect(
      createBudgetSchema.safeParse({ totalAmount: 100, lines: [rest] }).success,
    ).toBe(false);
  });

  it('acepta un ítem sin quantity ni unitCost', () => {
    const result = createBudgetSchema.safeParse({ totalAmount: 100, lines: [validLine] });
    expect(result.success).toBe(true);
  });

  it('no recalcula total a partir de quantity * unitCost', () => {
    const result = createBudgetSchema.safeParse({
      totalAmount: 100,
      lines: [{ ...validLine, quantity: 3, unitCost: 10, total: 100 }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lines[0].total).toBe(100);
  });
});
