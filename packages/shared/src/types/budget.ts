/**
 * Presupuesto de una obra (RF-05, corte 1: carga manual). Línea base +
 * contingencia + capítulos. El importador de planilla (.xlsx/.csv) es una
 * entrega aparte — `importMode` ya deja el lugar para `'import'`, pero en este
 * corte sólo existe `'manual'`.
 */

export type BudgetImportMode = 'manual' | 'import';

export interface BudgetLine {
  id: string;
  budgetId: string;
  projectId: string;
  /** Texto libre: la planilla real de un ejecutante no entra en un enum fijo. */
  chapter: string;
  /** Posición de carga — agrupar por capítulo respeta este orden, no alfabético. */
  order: number;
  name: string;
  unit: string;
  quantity?: number;
  unitCost?: number;
  total: number;
}

export interface Budget {
  id: string;
  projectId: string;
  version: number;
  /** Copiada de `Project.currency` al crear — la línea base queda congelada. */
  currency: string;
  totalAmount: number;
  contingencyAmount: number;
  importMode: BudgetImportMode;
  sourceFileName?: string;
  sourceRowCount?: number;
  importedBy: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithLines extends Budget {
  lines: BudgetLine[];
}

/** `null` cuando la obra todavía no tiene presupuesto cargado — no es un error. */
export interface BudgetResponse {
  budget: BudgetWithLines | null;
}

export interface CreateBudgetResponse {
  budget: BudgetWithLines;
}
