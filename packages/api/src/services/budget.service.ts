import mongoose from 'mongoose';
import {
  budgetHealthFor,
  isKnownUnit,
  pct,
  round2,
  type BudgetChapter,
  type BudgetChapterStatus,
  type BudgetImportPreview,
  type BudgetImportWarning,
  type BudgetStatus,
  type ColumnMapping,
} from '@luma/shared';
import { BudgetModel } from '../models/Budget.js';
import { MaterialModel } from '../models/Material.js';
import { ContingencyModel } from '../models/Contingency.js';
import { ProjectModel } from '../models/Project.js';
import { badRequest, notFound } from '../utils/errors.js';

// ─── Importación desde planilla (RF-05) ──────────────────────────────────────

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  chapter: ['capitulo', 'capítulo', 'rubro', 'seccion', 'sección', 'item padre'],
  code: ['codigo', 'código', 'cod', 'id'],
  name: ['descripcion', 'descripción', 'detalle', 'item', 'ítem', 'concepto', 'nombre'],
  unit: ['unidad', 'un', 'ud', 'medida'],
  quantity: ['cantidad', 'cant', 'qty'],
  unit_price: ['unitario', 'precio unitario', 'p. unitario', 'valor unitario', 'precio'],
  total: ['total', 'importe', 'subtotal', 'valor total'],
};

function normalize(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Adivina qué columna es cuál a partir de los encabezados.
 *
 * Es una propuesta, no una imposición: §13.7 deja abierto cuán estandarizadas
 * están las planillas reales, así que el mapeo detectado se le muestra al
 * usuario en la vista previa y él lo corrige antes de confirmar.
 */
export function detectColumns(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const normalized = headers.map((h) => normalize(h ?? ''));

  for (const [field, hints] of Object.entries(HEADER_HINTS) as Array<
    [keyof ColumnMapping, string[]]
  >) {
    const index = normalized.findIndex((h) => h && hints.some((hint) => h.includes(hint)));
    if (index >= 0) mapping[field] = headers[index];
  }
  return mapping;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  // Formato local: "1.234.567,89" → 1234567.89
  const cleaned = value.replace(/[^\d,.-]/g, '');
  const normalized =
    cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convierte las filas de la planilla en capítulos e ítems, y devuelve TODO lo
 * que hace falta para la vista previa del RF-05: totales, filas incompletas,
 * unidades no reconocidas y duplicados.
 *
 * No escribe nada. La confirmación es un paso aparte a propósito: el usuario
 * tiene que poder mirar el resultado antes de fijar su línea base.
 */
export function buildPreview(
  rows: Array<Record<string, unknown>>,
  mapping: ColumnMapping,
  currency: string,
  declaredTotal?: number,
): BudgetImportPreview {
  const warnings: BudgetImportWarning[] = [];
  const chapters = new Map<string, BudgetChapter>();
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 por el encabezado, +1 porque Excel cuenta desde 1
    const name = String(row[mapping.name] ?? '').trim();
    if (!name) return; // fila vacía: se ignora en silencio, no es un problema

    const chapterName = String(row[mapping.chapter ?? ''] ?? 'General').trim() || 'General';
    const chapterCode = normalize(chapterName).replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'general';

    const quantity = toNumber(row[mapping.quantity ?? '']);
    const unitPrice = toNumber(row[mapping.unit_price ?? '']);
    const explicitTotal = toNumber(row[mapping.total ?? '']);
    const total = explicitTotal || round2(quantity * unitPrice);
    const unit = String(row[mapping.unit ?? ''] ?? 'un').trim() || 'un';

    if (!total) {
      warnings.push({
        kind: 'incomplete_row',
        row: rowNumber,
        message: `Fila ${rowNumber} ("${name}"): no se pudo calcular el importe.`,
      });
    }
    if (!isKnownUnit(unit)) {
      warnings.push({
        kind: 'unknown_unit',
        row: rowNumber,
        message: `Fila ${rowNumber}: la unidad "${unit}" no es una de las conocidas.`,
      });
    }

    const key = `${chapterCode}::${normalize(name)}`;
    if (seen.has(key)) {
      warnings.push({
        kind: 'duplicate',
        row: rowNumber,
        message: `Fila ${rowNumber}: "${name}" ya aparece en el capítulo "${chapterName}".`,
      });
    }
    seen.add(key);

    if (!chapters.has(chapterCode)) {
      chapters.set(chapterCode, { code: chapterCode, name: chapterName, items: [], total: 0 });
    }
    const chapter = chapters.get(chapterCode)!;
    chapter.items.push({
      code: mapping.code ? String(row[mapping.code] ?? '').trim() || undefined : undefined,
      name,
      unit,
      quantity,
      unit_price: unitPrice,
      total,
    });
    chapter.total = round2(chapter.total + total);
  });

  const list = [...chapters.values()];
  const total = round2(list.reduce((sum, c) => sum + c.total, 0));

  if (declaredTotal && Math.abs(declaredTotal - total) > 1) {
    warnings.push({
      kind: 'total_mismatch',
      message: `El total de la planilla (${declaredTotal}) no coincide con la suma de los ítems (${total}).`,
    });
  }

  return {
    chapters: list,
    total,
    currency,
    row_count: rows.length,
    warnings,
    detected_columns: mapping as unknown as Record<string, string>,
  };
}

// ─── Persistencia ────────────────────────────────────────────────────────────

/**
 * Guarda un presupuesto como versión nueva.
 *
 * La primera versión queda marcada como línea base y ninguna posterior se la
 * saca: "recarga posterior permitida sólo como nueva versión, conservando la
 * línea base original" (RF-05).
 */
export async function saveBudgetVersion(params: {
  projectId: string;
  userId: string;
  chapters: BudgetChapter[];
  currency: string;
  source: 'import' | 'manual';
  fileName?: string;
}) {
  const projectId = new mongoose.Types.ObjectId(params.projectId);
  const last = await BudgetModel.findOne({ project_id: projectId }).sort({ version: -1 }).lean();
  const version = (last?.version ?? 0) + 1;
  const total = round2(params.chapters.reduce((sum, c) => sum + c.total, 0));

  const budget = await BudgetModel.create({
    project_id: projectId,
    version,
    is_baseline: version === 1,
    source: params.source,
    file_name: params.fileName,
    currency: params.currency,
    chapters: params.chapters,
    total,
    imported_by: new mongoose.Types.ObjectId(params.userId),
  });

  await ProjectModel.updateOne(
    { _id: projectId },
    { budget_id: budget._id, currency: params.currency },
  );

  return budget;
}

export async function getBaseline(projectId: string) {
  return BudgetModel.findOne({
    project_id: new mongoose.Types.ObjectId(projectId),
    is_baseline: true,
  }).lean();
}

export async function getCurrentBudget(projectId: string) {
  return BudgetModel.findOne({ project_id: new mongoose.Types.ObjectId(projectId) })
    .sort({ version: -1 })
    .lean();
}

// ─── Estado presupuestal (RF-05) ─────────────────────────────────────────────

/**
 * Calcula ejecutado, comprometido, saldo y margen de maniobra.
 *
 * Definiciones, que valen más que el código:
 *  - ejecutado    = material comprado o ya en obra, a costo real si lo hay.
 *  - comprometido = aprobado pero todavía no gastado: imprevistos que el
 *                   cliente aprobó, más material solicitado y no comprado.
 *  - disponible   = línea base − ejecutado − comprometido.
 *  - margen       = disponible menos la tajada de rentabilidad del ejecutante
 *                   (`margin_pct` sobre la línea base). Es la holgura REAL
 *                   antes de empezar a perder plata.
 *
 * No hay pagos ni anticipos en ninguna de las cuatro: la plataforma controla
 * presupuesto, no caja (§"Exclusión explícita").
 */
export async function computeBudgetStatus(projectId: string): Promise<BudgetStatus> {
  const oid = new mongoose.Types.ObjectId(projectId);
  const project = await ProjectModel.findById(oid).lean();
  if (!project) throw notFound('Proyecto no encontrado');

  const baseline = await getBaseline(projectId);
  const chapters = baseline?.chapters ?? [];
  const baselineTotal = baseline?.total ?? 0;
  const currency = baseline?.currency ?? project.currency;

  const materials = await MaterialModel.find({ project_id: oid }).lean();
  const contingencies = await ContingencyModel.find({
    project_id: oid,
    status: { $in: ['client_approved', 'internal_approved', 'sent_to_client'] },
  }).lean();

  const executedByChapter = new Map<string, number>();
  const committedByChapter = new Map<string, number>();
  const add = (map: Map<string, number>, key: string | undefined, value: number) => {
    const k = key ?? '__sin_capitulo__';
    map.set(k, round2((map.get(k) ?? 0) + value));
  };

  let executed = 0;
  let committed = 0;

  for (const m of materials) {
    const cost = m.actual_cost ?? m.estimated_cost ?? 0;
    if (m.status === 'purchased' || m.status === 'on_site') {
      executed = round2(executed + cost);
      add(executedByChapter, m.chapter_code, cost);
    } else if (m.status === 'requested') {
      committed = round2(committed + cost);
      add(committedByChapter, m.chapter_code, cost);
    }
  }

  for (const c of contingencies) {
    // Sólo lo que el cliente aprobó modifica la línea base (regla 9). Lo que
    // está en camino se muestra como comprometido para que nadie se sorprenda.
    committed = round2(committed + c.impact_cost);
    add(committedByChapter, c.chapter_code, c.impact_cost);
  }

  const available = round2(baselineTotal - executed - committed);
  const profitReserve = round2((baselineTotal * project.margin_pct) / 100);
  const maneuverMargin = round2(available - profitReserve);

  const deviation = executed + committed - baselineTotal;
  const deviationPct = baselineTotal ? pct(deviation, baselineTotal) : 0;

  const byChapter: BudgetChapterStatus[] = chapters.map((chapter) => {
    const chExecuted = executedByChapter.get(chapter.code) ?? 0;
    const chCommitted = committedByChapter.get(chapter.code) ?? 0;
    const chDeviation = round2(chExecuted + chCommitted - chapter.total);
    const chDeviationPct = chapter.total ? pct(chDeviation, chapter.total) : 0;
    return {
      code: chapter.code,
      name: chapter.name,
      baseline: chapter.total,
      executed: chExecuted,
      committed: chCommitted,
      deviation: chDeviation,
      deviation_pct: chDeviationPct,
      health: budgetHealthFor(chDeviationPct, project.budget_thresholds),
    };
  });

  return {
    currency,
    baseline: baselineTotal,
    executed,
    committed,
    available,
    maneuver_margin: maneuverMargin,
    maneuver_margin_pct: baselineTotal ? pct(maneuverMargin, baselineTotal) : 0,
    health: budgetHealthFor(deviationPct, project.budget_thresholds),
    by_chapter: byChapter,
  };
}

export function assertHasBaseline(baseline: unknown): void {
  if (!baseline) {
    throw badRequest(
      'El proyecto todavía no tiene presupuesto cargado. Importá la planilla primero.',
      'NO_BASELINE',
    );
  }
}
