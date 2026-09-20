import { describe, expect, it } from 'vitest';
import {
  buildImportPreview,
  detectColumnMapping,
  mapSpreadsheetRows,
  normalizeHeader,
  parseLocaleNumber,
} from './parse-budget-spreadsheet';

describe('normalizeHeader', () => {
  it('saca tildes y pasa a minúscula', () => {
    expect(normalizeHeader('Capítulo')).toBe('capitulo');
    expect(normalizeHeader('  Ítem  ')).toBe('item');
  });
});

describe('detectColumnMapping', () => {
  it('mapea los encabezados del ejemplo del documento funcional', () => {
    const headers = ['Capítulo', 'Ítem', 'Unidad', 'Cantidad', 'Valor unitario', 'Valor total'];
    expect(detectColumnMapping(headers)).toEqual({
      chapter: 0,
      name: 1,
      unit: 2,
      quantity: 3,
      unitCost: 4,
      total: 5,
    });
  });

  it('deja sin mapear una columna que no matchea ningún sinónimo', () => {
    const mapping = detectColumnMapping(['Capítulo', 'Algo raro', 'Unidad', 'Total']);
    expect(mapping.name).toBeUndefined();
    expect(mapping.chapter).toBe(0);
  });
});

describe('parseLocaleNumber', () => {
  it('acepta un número ya numérico (viene de xlsx)', () => {
    expect(parseLocaleNumber(1234.5)).toBe(1234.5);
  });

  it('interpreta "1.234,56" como es-AR (punto de miles, coma decimal)', () => {
    expect(parseLocaleNumber('1.234,56')).toBe(1234.56);
  });

  it('interpreta "1,234.56" como en-US (coma de miles, punto decimal)', () => {
    expect(parseLocaleNumber('1,234.56')).toBe(1234.56);
  });

  it('interpreta "1234,56" (sólo coma, 2 decimales) como decimal', () => {
    expect(parseLocaleNumber('1234,56')).toBe(1234.56);
  });

  it('interpreta "1.234" (sólo punto, 3 dígitos) como separador de miles', () => {
    expect(parseLocaleNumber('1.234')).toBe(1234);
  });

  it('interpreta "1.5" (sólo punto, 1 dígito) como decimal', () => {
    expect(parseLocaleNumber('1.5')).toBe(1.5);
  });

  it('devuelve undefined para vacío o no numérico', () => {
    expect(parseLocaleNumber('')).toBeUndefined();
    expect(parseLocaleNumber('   ')).toBeUndefined();
    expect(parseLocaleNumber('no es un número')).toBeUndefined();
    expect(parseLocaleNumber(undefined)).toBeUndefined();
    expect(parseLocaleNumber(null)).toBeUndefined();
  });
});

describe('mapSpreadsheetRows + buildImportPreview', () => {
  const mapping = { chapter: 0, name: 1, unit: 2, quantity: 3, unitCost: 4, total: 5 };

  it('arma filas válidas y calcula el total', () => {
    const rows = mapSpreadsheetRows(
      [
        ['Demolición', 'Retiro de escombros', 'global', null, null, '100000'],
        ['Demolición', 'Volqueta', 'un', 2, 50000, 100000],
      ],
      mapping,
    );
    const preview = buildImportPreview(rows);

    expect(preview.validRows).toHaveLength(2);
    expect(preview.incompleteCount).toBe(0);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.totalAmount).toBe(200000);
  });

  it('cuenta como incompleta una fila sin total', () => {
    const rows = mapSpreadsheetRows(
      [['Demolición', 'Retiro de escombros', 'global', null, null, null]],
      mapping,
    );
    const preview = buildImportPreview(rows);

    expect(preview.validRows).toHaveLength(0);
    expect(preview.incompleteCount).toBe(1);
  });

  it('ignora una fila completamente vacía sin contarla como incompleta', () => {
    const rows = mapSpreadsheetRows([['', '', '', null, null, null]], mapping);
    const preview = buildImportPreview(rows);

    expect(preview.validRows).toHaveLength(0);
    expect(preview.incompleteCount).toBe(0);
  });

  it('detecta un duplicado por (capítulo, ítem, unidad) pero lo deja pasar', () => {
    const rows = mapSpreadsheetRows(
      [
        ['Demolición', 'Retiro de escombros', 'global', null, null, '100000'],
        ['demolición', 'retiro de escombros', 'GLOBAL', null, null, '50000'],
      ],
      mapping,
    );
    const preview = buildImportPreview(rows);

    expect(preview.validRows).toHaveLength(2);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.totalAmount).toBe(150000);
  });

  it('no recalcula total a partir de quantity * unitCost cuando difieren', () => {
    const rows = mapSpreadsheetRows([['Demolición', 'Ítem', 'un', 3, 10, 100]], mapping);
    expect(rows[0].total).toBe(100);
  });
});
