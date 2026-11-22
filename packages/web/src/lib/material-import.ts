import { MATERIAL_BULK_MAX, type BulkCreateMaterialItem, type MaterialUnit } from '@luma/shared';
import type { SheetCell } from './google-sheets';

/**
 * Importar materiales desde una planilla (Compras → Importar de Google Sheets).
 * Reglas puras: de las celdas de la planilla a la lista que se manda a la API.
 *
 * La primera fila con algo escrito es el encabezado, y las columnas se
 * reconocen por su nombre, en castellano, portugués o inglés, sin importar el
 * orden ni las tildes. Así entra tanto la planilla de un proveedor como una
 * lista que salió de Luma ("Guardar como Google Sheet"). Lo que no se reconoce
 * se ignora.
 *
 * Una fila que no se puede leer no frena el resto: se salta y se informa con su
 * número de fila, para que la persona la corrija en la planilla.
 */

export type ImportField = 'name' | 'quantity' | 'unit' | 'estimatedCost' | 'supplier';

/** Por qué se salta una fila. La UI lo traduce (`material.import.rowErrors.*`). */
export type ImportRowError = 'name' | 'quantity' | 'unit' | 'cost';

export interface ImportRow {
  /** Número de fila en la planilla (1 = la primera), para que la persona la encuentre. */
  line: number;
  item?: BulkCreateMaterialItem;
  error?: ImportRowError;
}

export type ImportPlan =
  | { ok: true; columns: Partial<Record<ImportField, number>>; items: BulkCreateMaterialItem[]; skipped: ImportRow[] }
  | { ok: false; reason: 'empty' | 'noName' | 'noQuantity' | 'tooMany' };

/** Nombres de columna conocidos, ya normalizados (sin tildes, en minúscula). */
const HEADER_ALIASES: Record<ImportField, readonly string[]> = {
  name: ['material', 'materiales', 'nombre', 'descripcion', 'item', 'producto', 'articulo', 'insumo', 'nome', 'descricao', 'name', 'description'],
  quantity: ['cantidad', 'cant', 'cant.', 'quantidade', 'qtd', 'qtde', 'quantity', 'qty'],
  unit: ['unidad', 'unidades', 'unidad de medida', 'medida', 'u.m.', 'um', 'und', 'unidade', 'unit', 'uom'],
  estimatedCost: ['costo', 'costo estimado', 'costo estimado (opcional)', 'precio', 'precio estimado', 'importe', 'custo', 'custo estimado', 'custo estimado (opcional)', 'preco', 'cost', 'estimated cost', 'price'],
  supplier: ['proveedor', 'fornecedor', 'supplier', 'vendor'],
};

/** Cómo se escriben las unidades en una planilla, normalizado. Vacío = unidad. */
const UNIT_ALIASES: Record<MaterialUnit, readonly string[]> = {
  un: ['un', 'u', 'u.', 'und', 'unid', 'unidad', 'unidades', 'unidade', 'pza', 'pieza', 'piezas', 'pz', 'pc', 'pcs', 'unit', 'units', 'ea'],
  m: ['m', 'mt', 'mts', 'ml', 'metro', 'metros', 'metro lineal', 'metros lineales'],
  m2: ['m2', 'm²', 'mt2', 'mts2', 'metro cuadrado', 'metros cuadrados', 'metro quadrado', 'metros quadrados'],
  m3: ['m3', 'm³', 'mt3', 'mts3', 'metro cubico', 'metros cubicos'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'quilo', 'quilos', 'quilograma', 'quilogramas'],
  l: ['l', 'lt', 'lts', 'litro', 'litros'],
  bolsa: ['bolsa', 'bolsas', 'saco', 'sacos', 'bag', 'bags'],
  rollo: ['rollo', 'rollos', 'rolo', 'rolos', 'roll', 'rolls'],
  global: ['global', 'gl', 'glb'],
};

export function normalizeLabel(value: SheetCell | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Qué columna es cada campo. La primera que coincide gana. */
export function detectColumns(header: SheetCell[]): Partial<Record<ImportField, number>> {
  const columns: Partial<Record<ImportField, number>> = {};
  header.forEach((cell, index) => {
    const label = normalizeLabel(cell);
    if (!label) return;
    for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
      if (columns[field] === undefined && HEADER_ALIASES[field].includes(label)) {
        columns[field] = index;
        return;
      }
    }
  });
  return columns;
}

/** `null` si la unidad no se reconoce. Una celda vacía es "unidad". */
export function parseUnit(value: SheetCell | undefined): MaterialUnit | null {
  const label = normalizeLabel(value);
  if (!label) return 'un';
  for (const unit of Object.keys(UNIT_ALIASES) as MaterialUnit[]) {
    if (unit === label || UNIT_ALIASES[unit].includes(label)) return unit;
  }
  return null;
}

/**
 * Un número escrito a mano: "12,5", "1.234,50", "1,234.50", "$ 40". Las
 * celdas numéricas ya llegan como número (se leen sin formato); esto es para
 * las que alguien tipeó como texto. Con un solo separador, es el decimal.
 */
export function parseNumber(value: SheetCell | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = String(value ?? '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  const commas = text.split(',').length - 1;
  const dots = text.split('.').length - 1;
  if (commas > 0 && dots > 0) {
    // El último que aparece es el decimal; el otro, de miles.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    text = text.split(thousands).join('').replace(decimal, '.');
  } else if (commas > 1) {
    text = text.split(',').join('');
  } else if (dots > 1) {
    text = text.split('.').join('');
  } else {
    text = text.replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function cellText(row: SheetCell[], index: number | undefined): string {
  return index === undefined ? '' : String(row[index] ?? '').trim();
}

/** De las celdas de la planilla a lo que se manda a la API. */
export function planMaterialImport(values: SheetCell[][], max = MATERIAL_BULK_MAX): ImportPlan {
  const isBlank = (row: SheetCell[] | undefined) => !row || row.every((cell) => String(cell ?? '').trim() === '');
  const headerIndex = values.findIndex((row) => !isBlank(row));
  if (headerIndex === -1) return { ok: false, reason: 'empty' };

  const columns = detectColumns(values[headerIndex]!);
  if (columns.name === undefined) return { ok: false, reason: 'noName' };
  if (columns.quantity === undefined) return { ok: false, reason: 'noQuantity' };

  const items: BulkCreateMaterialItem[] = [];
  const skipped: ImportRow[] = [];

  for (let index = headerIndex + 1; index < values.length; index++) {
    const row = values[index] ?? [];
    if (isBlank(row)) continue;
    const line = index + 1;

    const name = cellText(row, columns.name).slice(0, 120);
    if (!name) {
      skipped.push({ line, error: 'name' });
      continue;
    }
    const quantity = parseNumber(row[columns.quantity]);
    if (quantity === null || quantity <= 0) {
      skipped.push({ line, error: 'quantity' });
      continue;
    }
    const unit = columns.unit === undefined ? 'un' : parseUnit(row[columns.unit]);
    if (!unit) {
      skipped.push({ line, error: 'unit' });
      continue;
    }

    const item: BulkCreateMaterialItem = { name, quantity, unit };

    const costCell = cellText(row, columns.estimatedCost);
    if (costCell) {
      const cost = parseNumber(row[columns.estimatedCost!]);
      if (cost === null || cost < 0) {
        skipped.push({ line, error: 'cost' });
        continue;
      }
      item.estimatedCost = cost;
    }

    const supplier = cellText(row, columns.supplier).slice(0, 120);
    if (supplier) item.supplier = supplier;

    items.push(item);
  }

  if (items.length === 0 && skipped.length === 0) return { ok: false, reason: 'empty' };
  if (items.length > max) return { ok: false, reason: 'tooMany' };
  return { ok: true, columns, items, skipped };
}
