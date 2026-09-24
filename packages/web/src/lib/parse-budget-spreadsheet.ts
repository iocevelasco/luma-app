/**
 * Parseo de la planilla de presupuesto (RF-05, corte 2 — importador).
 *
 * Sin dependencia de React ni del DOM a propósito: es la parte del importador
 * que más vale la pena poder testear con datos crudos, sin simular un `<input
 * type="file">`.
 *
 * Las librerías de parseo (`read-excel-file`, `papaparse`) entran por
 * `import()` dinámico desde quien llama esto — ni un byte en el bundle
 * principal para algo que se usa una vez por obra.
 */

export type SpreadsheetCell = string | number | null;

export interface ParsedSpreadsheet {
  headers: string[];
  /** Filas de datos, sin la fila de encabezado. */
  rows: SpreadsheetCell[][];
}

export type SpreadsheetParseErrorCode = 'unsupported_type' | 'empty' | 'corrupt' | 'too_many_rows';

export class SpreadsheetParseError extends Error {
  readonly code: SpreadsheetParseErrorCode;

  constructor(code: SpreadsheetParseErrorCode) {
    super(code);
    this.name = 'SpreadsheetParseError';
    this.code = code;
    Object.setPrototypeOf(this, SpreadsheetParseError.prototype);
  }
}

/** No es una obra real si trae más filas que esto — es un archivo equivocado. */
export const MAX_SPREADSHEET_ROWS = 2000;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

async function parseCsvFile(file: File): Promise<ParsedSpreadsheet> {
  const Papa = (await import('papaparse')).default;
  const text = await file.text();

  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const [headers, ...rows] = result.data;

  if (!headers || headers.length === 0) throw new SpreadsheetParseError('empty');
  return { headers, rows };
}

async function parseXlsxFile(file: File): Promise<ParsedSpreadsheet> {
  // El paquete no tiene export raíz: `/browser` es la build isomorfa para
  // navegador, a diferencia de `/node`, que usa `fs`. `readXlsxFile` (el
  // default export) devuelve TODAS las hojas del archivo — `readSheet` es la
  // función que da directamente las filas de una sola hoja (la primera, acá).
  const { readSheet } = await import('read-excel-file/browser');

  let sheetRows: unknown[][];
  try {
    sheetRows = await readSheet(file);
  } catch {
    throw new SpreadsheetParseError('corrupt');
  }

  if (sheetRows.length === 0) throw new SpreadsheetParseError('empty');

  const [headerRow, ...dataRows] = sheetRows;
  const headers = headerRow.map((cell) => cellToString(cell));
  const rows = dataRows.map((row) => row.map((cell) => cellToCellValue(cell)));

  return { headers, rows };
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  return String(cell);
}

function cellToCellValue(cell: unknown): SpreadsheetCell {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'number') return cell;
  return String(cell);
}

/**
 * Sniffea el tipo por extensión, no por MIME: iOS Safari entrega archivos
 * de iCloud con `file.type` vacío — ver CLAUDE.md sobre cross-browsing.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const extension = extensionOf(file.name);

  const parsed =
    extension === 'csv'
      ? await parseCsvFile(file)
      : extension === 'xlsx'
        ? await parseXlsxFile(file)
        : (() => {
            throw new SpreadsheetParseError('unsupported_type');
          })();

  if (parsed.rows.length > MAX_SPREADSHEET_ROWS) throw new SpreadsheetParseError('too_many_rows');

  return parsed;
}

export type BudgetColumnKey = 'chapter' | 'name' | 'unit' | 'quantity' | 'unitCost' | 'total';

export const BUDGET_COLUMN_KEYS: BudgetColumnKey[] = [
  'chapter',
  'name',
  'unit',
  'quantity',
  'unitCost',
  'total',
];

export const REQUIRED_BUDGET_COLUMNS: BudgetColumnKey[] = ['chapter', 'name', 'unit', 'total'];

/** Sinónimos ya sin tildes — comparar siempre contra un header normalizado. */
const COLUMN_SYNONYMS: Record<BudgetColumnKey, string[]> = {
  chapter: ['capitulo', 'rubro', 'seccion', 'chapter'],
  name: ['item', 'nombre', 'descripcion', 'concepto', 'name'],
  unit: ['unidad', 'un', 'u.m.', 'um', 'unit'],
  quantity: ['cantidad', 'cant', 'qty', 'quantity'],
  unitCost: ['valor unitario', 'costo unitario', 'precio unitario', 'v. unitario', 'p.u.', 'unit cost'],
  total: ['valor total', 'total', 'importe', 'subtotal'],
};

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Quita tildes vía NFD + rango de marcas combinantes — evita comparar "capítulo" contra "capitulo" y no matchear. */
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS, '');
}

/** Auto-mapeo por nombre de columna. Lo que no matchea queda `undefined` — se resuelve a mano en la UI. */
export function detectColumnMapping(headers: string[]): Partial<Record<BudgetColumnKey, number>> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<BudgetColumnKey, number>> = {};

  for (const key of BUDGET_COLUMN_KEYS) {
    const index = normalized.findIndex((header) => COLUMN_SYNONYMS[key].includes(header));
    if (index !== -1) mapping[key] = index;
  }

  return mapping;
}

/**
 * Convierte una celda a número aceptando "1.234,56" (es-AR) y "1234.56".
 *
 * Ambiguo por diseño cuando sólo hay un tipo de separador: un único "." con
 * 3 dígitos después se interpreta como separador de miles (sesgo hacia
 * es-AR, la configuración regional por defecto de la app), no como decimal.
 * La vista previa del importador es la red de contención real — quien carga
 * ve el número ya interpretado antes de confirmar.
 */
export function parseLocaleNumber(raw: SpreadsheetCell | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;

  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  let normalized = trimmed;

  if (hasComma && hasDot) {
    const decimalIsComma = trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.');
    normalized = decimalIsComma
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    const parts = trimmed.split(',');
    normalized =
      parts.length === 2 && parts[1].length <= 2 ? trimmed.replace(',', '.') : trimmed.replace(/,/g, '');
  } else if (hasDot) {
    const parts = trimmed.split('.');
    normalized = parts.length > 2 || parts[parts.length - 1].length === 3
      ? trimmed.replace(/\./g, '')
      : trimmed;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export interface MappedBudgetRow {
  chapter: string;
  name: string;
  unit: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
}

function cellAt(row: SpreadsheetCell[], index: number | undefined): SpreadsheetCell | undefined {
  return index === undefined ? undefined : row[index];
}

export function mapSpreadsheetRows(
  rows: SpreadsheetCell[][],
  mapping: Partial<Record<BudgetColumnKey, number>>,
): MappedBudgetRow[] {
  return rows.map((row) => ({
    chapter: String(cellAt(row, mapping.chapter) ?? '').trim(),
    name: String(cellAt(row, mapping.name) ?? '').trim(),
    unit: String(cellAt(row, mapping.unit) ?? '').trim(),
    quantity: parseLocaleNumber(cellAt(row, mapping.quantity)),
    unitCost: parseLocaleNumber(cellAt(row, mapping.unitCost)),
    total: parseLocaleNumber(cellAt(row, mapping.total)),
  }));
}

function isBlankRow(row: MappedBudgetRow): boolean {
  return !row.chapter && !row.name && !row.unit && row.total === undefined;
}

function isCompleteRow(row: MappedBudgetRow): boolean {
  return Boolean(row.chapter && row.name && row.unit && row.total !== undefined);
}

export interface BudgetImportPreview {
  validRows: MappedBudgetRow[];
  incompleteCount: number;
  duplicateCount: number;
  totalAmount: number;
}

/** Filas válidas (para importar), más los conteos que informa la vista previa. */
export function buildImportPreview(rows: MappedBudgetRow[]): BudgetImportPreview {
  const nonBlank = rows.filter((row) => !isBlankRow(row));
  const validRows = nonBlank.filter(isCompleteRow);
  const incompleteCount = nonBlank.length - validRows.length;

  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const row of validRows) {
    const key = `${row.chapter.toLowerCase()}|${row.name.toLowerCase()}|${row.unit.toLowerCase()}`;
    if (seen.has(key)) duplicateCount += 1;
    seen.add(key);
  }

  const totalAmount = validRows.reduce((sum, row) => sum + (row.total ?? 0), 0);

  return { validRows, incompleteCount, duplicateCount, totalAmount: Math.round(totalAmount * 100) / 100 };
}
