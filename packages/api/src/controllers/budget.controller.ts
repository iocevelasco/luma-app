import type { Request, Response } from 'express';
import {
  createBudgetSchema,
  roundMoney,
  type Budget as BudgetDTO,
  type BudgetLine as BudgetLineDTO,
} from '@luma/shared';
import { Budget, type IBudget } from '../models/Budget.js';
import { BudgetLine, type IBudgetLine } from '../models/BudgetLine.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

function toBudgetDTO(budget: IBudget): BudgetDTO {
  return {
    id: String(budget._id),
    projectId: String(budget.project),
    version: budget.version,
    currency: budget.currency,
    totalAmount: budget.totalAmount,
    contingencyAmount: budget.contingencyAmount,
    importMode: budget.importMode,
    sourceFileName: budget.sourceFileName,
    sourceRowCount: budget.sourceRowCount,
    importedBy: String(budget.importedBy),
    importedAt: budget.importedAt.toISOString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

function toBudgetLineDTO(line: IBudgetLine): BudgetLineDTO {
  return {
    id: String(line._id),
    budgetId: String(line.budget),
    projectId: String(line.project),
    chapter: line.chapter,
    order: line.order,
    name: line.name,
    unit: line.unit,
    quantity: line.quantity,
    unitCost: line.unitCost,
    total: line.total,
  };
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes (montado a nivel router: ver routes/budget.ts). */
export async function getBudget(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const budget = await Budget.findOne({ project: project._id }).sort({ version: -1 });

    if (!budget) {
      // Todavía no hay presupuesto cargado — es el estado sano de una obra
      // recién creada, no un error. La pantalla lo resuelve con un vacío.
      return res.json({ success: true, data: { budget: null } });
    }

    const lines = await BudgetLine.find({ budget: budget._id }).sort({ order: 1 });

    return res.json({
      success: true,
      data: { budget: { ...toBudgetDTO(budget), lines: lines.map(toBudgetLineDTO) } },
    });
  } catch (error) {
    console.error('❌ [BUDGET] getBudget:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Carga manual
 * (RF-05, corte 1): un solo Budget vigente por obra — no hay versionado real
 * todavía. `totalAmount` lo declara quien carga, pero nunca se confía en él:
 * se valida contra la suma de los ítems, y si no coincide es un 400 con el
 * detalle, no un ajuste silencioso.
 */
export async function createBudget(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createBudgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { totalAmount, contingencyAmount, lines, importMode, sourceFileName, sourceRowCount } =
      parsed.data;

    const linesSum = roundMoney(lines.reduce((sum, line) => sum + line.total, 0));
    if (linesSum !== totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'El total no coincide con la suma de los ítems',
        details: { totalAmount, linesSum },
      });
    }

    const existing = await Budget.findOne({ project: project._id });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: 'Esta obra ya tiene un presupuesto cargado' });
    }

    const budget = await Budget.create({
      project: project._id,
      version: 1,
      currency: project.currency,
      totalAmount,
      contingencyAmount,
      importMode,
      sourceFileName,
      sourceRowCount,
      importedBy: req.user.sub,
      importedAt: new Date(),
    });

    const createdLines = (await BudgetLine.insertMany(
      lines.map((line, index) => ({
        budget: budget._id,
        project: project._id,
        chapter: line.chapter,
        order: index,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        unitCost: line.unitCost,
        total: line.total,
      })),
    )) as IBudgetLine[];

    return res.status(201).json({
      success: true,
      data: { budget: { ...toBudgetDTO(budget), lines: createdLines.map(toBudgetLineDTO) } },
    });
  } catch (error) {
    // Última barrera contra un reintento de red: si el primer POST ya
    // escribió, el índice único (project, version) rechaza el segundo acá,
    // en vez de dejar dos presupuestos vigentes para la misma obra.
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ success: false, error: 'Esta obra ya tiene un presupuesto cargado' });
    }
    console.error('❌ [BUDGET] createBudget:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
