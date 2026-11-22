import { describe, expect, it } from 'vitest';
import { detectColumns, parseNumber, parseUnit, planMaterialImport } from './material-import';

describe('detectColumns', () => {
  it('reconoce las columnas por nombre, sin importar orden, tildes ni idioma', () => {
    expect(detectColumns(['Proveedor', 'Descripción', 'CANT', 'Unidad de medida', 'Precio'])).toEqual({
      supplier: 0,
      name: 1,
      quantity: 2,
      unit: 3,
      estimatedCost: 4,
    });
    expect(detectColumns(['Material', 'Quantidade', 'Unidade', 'Fornecedor'])).toEqual({
      name: 0,
      quantity: 1,
      unit: 2,
      supplier: 3,
    });
  });

  it('lee la lista que sale de Luma ("Guardar como Google Sheet")', () => {
    expect(detectColumns(['Material', 'Cantidad', 'Unidad', 'Proveedor', 'Nota'])).toEqual({
      name: 0,
      quantity: 1,
      unit: 2,
      supplier: 3,
    });
  });
});

describe('parseUnit', () => {
  it.each([
    ['', 'un'],
    ['Unidad', 'un'],
    ['pza', 'un'],
    ['m²', 'm2'],
    ['Metros cúbicos', 'm3'],
    ['Kilos', 'kg'],
    ['lts', 'l'],
    ['Saco', 'bolsa'],
    ['Rolo', 'rollo'],
    ['GL', 'global'],
  ])('%s → %s', (raw, unit) => {
    expect(parseUnit(raw)).toBe(unit);
  });

  it('null si no la reconoce', () => {
    expect(parseUnit('carretilla')).toBeNull();
  });
});

describe('parseNumber', () => {
  it.each([
    [12, 12],
    ['12', 12],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1.234,50', 1234.5],
    ['1,234.50', 1234.5],
    ['1.234.567', 1234567],
    ['$ 40', 40],
  ])('%s → %s', (raw, value) => {
    expect(parseNumber(raw)).toBe(value);
  });

  it('null si no hay número', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('mucho')).toBeNull();
  });
});

describe('planMaterialImport', () => {
  it('arma la lista desde el encabezado y salta las filas vacías', () => {
    const plan = planMaterialImport([
      [],
      ['Material', 'Cantidad', 'Unidad', 'Costo', 'Proveedor'],
      ['Cemento', 10, 'bolsas', 12.5, 'Ferretería Sur'],
      ['', '', '', '', ''],
      ['Arena', '2,5', 'm3', '', ''],
    ]);
    expect(plan).toEqual({
      ok: true,
      columns: { name: 0, quantity: 1, unit: 2, estimatedCost: 3, supplier: 4 },
      items: [
        { name: 'Cemento', quantity: 10, unit: 'bolsa', estimatedCost: 12.5, supplier: 'Ferretería Sur' },
        { name: 'Arena', quantity: 2.5, unit: 'm3' },
      ],
      skipped: [],
    });
  });

  it('sin columna de unidad, todo es "unidad"', () => {
    const plan = planMaterialImport([['Nombre', 'Cantidad'], ['Llave de paso', 3]]);
    expect(plan.ok && plan.items).toEqual([{ name: 'Llave de paso', quantity: 3, unit: 'un' }]);
  });

  it('salta las filas que no se pueden leer, con su número de fila', () => {
    const plan = planMaterialImport([
      ['Material', 'Cantidad', 'Unidad', 'Costo'],
      ['', 4, 'un', ''],
      ['Ladrillo', 0, 'un', ''],
      ['Caño', 2, 'carretilla', ''],
      ['Pintura', 1, 'l', 'caro'],
      ['Yeso', 5, 'kg', ''],
    ]);
    expect(plan.ok && plan.items).toEqual([{ name: 'Yeso', quantity: 5, unit: 'kg' }]);
    expect(plan.ok && plan.skipped).toEqual([
      { line: 2, error: 'name' },
      { line: 3, error: 'quantity' },
      { line: 4, error: 'unit' },
      { line: 5, error: 'cost' },
    ]);
  });

  it('no sigue si falta una columna obligatoria, la planilla está vacía o son demasiados', () => {
    expect(planMaterialImport([])).toEqual({ ok: false, reason: 'empty' });
    expect(planMaterialImport([['Material', 'Cantidad']])).toEqual({ ok: false, reason: 'empty' });
    expect(planMaterialImport([['Cantidad'], [3]])).toEqual({ ok: false, reason: 'noName' });
    expect(planMaterialImport([['Material'], ['Cemento']])).toEqual({ ok: false, reason: 'noQuantity' });
    expect(planMaterialImport([['Material', 'Cantidad'], ['a', 1], ['b', 1], ['c', 1]], 2)).toEqual({
      ok: false,
      reason: 'tooMany',
    });
  });
});
