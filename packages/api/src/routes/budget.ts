import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { columnMappingSchema, confirmBudgetImportSchema } from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { BudgetModel } from '../models/Budget.js';
import * as budgetService from '../services/budget.service.js';
import { audit } from '../services/audit.service.js';
import { badRequest } from '../utils/errors.js';

export const budgetRouter = Router();

budgetRouter.use(isAuthenticated, withProject);

// En memoria y con tope: una planilla de presupuesto de obra pesa kilobytes.
// Aceptar 50 MB sólo abre la puerta a que alguien suba un video.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Estado presupuestal completo: ejecutado, comprometido, margen, semáforo. */
budgetRouter.get(
  '/status',
  asyncHandler(async (req, res) => {
    const status = await budgetService.computeBudgetStatus(req.projectId!);

    // El cliente ve el resumen, no el desglose por capítulo ni el margen del
    // ejecutante (§2.4 y regla 4). Su vista propia vive en /api/client.
    if (req.projectRole === 'client') {
      const { baseline, executed, committed, available, currency, health } = status;
      return res.json({
        success: true,
        data: { baseline, executed, committed, available, currency, health, by_chapter: [] },
      });
    }

    res.json({ success: true, data: status });
  }),
);

budgetRouter.get(
  '/versions',
  requirePermission('budget.view.full'),
  asyncHandler(async (req, res) => {
    const versions = await BudgetModel.find({
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    })
      .select({ version: 1, is_baseline: 1, total: 1, source: 1, file_name: 1, createdAt: 1 })
      .sort({ version: -1 })
      .lean();
    res.json({ success: true, data: versions.map((v) => ({ ...v, id: v._id.toString() })) });
  }),
);

budgetRouter.get(
  '/current',
  requirePermission('budget.view.full'),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.getCurrentBudget(req.projectId!);
    res.json({ success: true, data: budget ? { ...budget, id: budget._id.toString() } : null });
  }),
);

/**
 * Paso 1 de la importación: subir la planilla y ver qué se entendió.
 *
 * No escribe nada. El documento lo pide explícitamente —"vista previa con
 * validación antes de confirmar la carga"— y con razón: el presupuesto
 * importado queda como línea base del proyecto, y una línea base mal cargada
 * hace que todas las previsiones mientan (§12, "calidad del presupuesto
 * inicial").
 */
budgetRouter.post(
  '/import/preview',
  requirePermission('budget.import'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Subí un archivo .xlsx o .csv', 'NO_FILE');

    const XLSX = await import('xlsx');
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = (req.body.sheet as string) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw badRequest(`La planilla no tiene una hoja "${sheetName}"`, 'NO_SHEET');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) throw badRequest('La hoja está vacía', 'EMPTY_SHEET');

    const headers = Object.keys(rows[0]);
    const detected = budgetService.detectColumns(headers);

    // El mapeo puede venir del cliente (segunda pasada, después de corregir) o
    // salir de la detección automática.
    const mappingInput = req.body.mapping ? JSON.parse(req.body.mapping as string) : detected;
    const mapping = columnMappingSchema.safeParse(mappingInput);
    if (!mapping.success) {
      return res.status(200).json({
        success: true,
        data: {
          needs_mapping: true,
          headers,
          sheets: workbook.SheetNames,
          detected_columns: detected,
          message: 'No pudimos identificar la columna de descripción. Indicá el mapeo.',
        },
      });
    }

    const preview = budgetService.buildPreview(
      rows,
      mapping.data,
      (req.body.currency as string) || 'ARS',
      req.body.declared_total ? Number(req.body.declared_total) : undefined,
    );

    res.json({
      success: true,
      data: { ...preview, headers, sheets: workbook.SheetNames, file_name: req.file.originalname },
    });
  }),
);

/** Paso 2: se confirma lo que se vio y recién ahí se escribe. */
budgetRouter.post(
  '/import/confirm',
  requirePermission('budget.import'),
  validateBody(confirmBudgetImportSchema),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.saveBudgetVersion({
      projectId: req.projectId!,
      userId: req.user!.sub,
      chapters: req.body.chapters,
      currency: req.body.currency,
      source: 'import',
      fileName: req.body.file_name,
    });

    await audit({
      projectId: req.projectId!,
      userId: req.user!.sub,
      action: budget.is_baseline ? 'budget.set_baseline' : 'budget.new_version',
      entity: 'Budget',
      entityId: budget._id.toString(),
      summary: `Presupuesto v${budget.version} por ${budget.total} ${budget.currency}`,
    });

    res.status(201).json({
      success: true,
      data: { id: budget._id.toString(), version: budget.version, total: budget.total },
    });
  }),
);

/** Captura manual, para obras chicas sin planilla previa (RF-05). */
budgetRouter.post(
  '/manual',
  requirePermission('budget.import'),
  validateBody(confirmBudgetImportSchema),
  asyncHandler(async (req, res) => {
    const budget = await budgetService.saveBudgetVersion({
      projectId: req.projectId!,
      userId: req.user!.sub,
      chapters: req.body.chapters,
      currency: req.body.currency,
      source: 'manual',
    });
    res.status(201).json({
      success: true,
      data: { id: budget._id.toString(), version: budget.version, total: budget.total },
    });
  }),
);

/** Comparación entre dos versiones: para eso se conserva la línea base. */
budgetRouter.get(
  '/compare',
  requirePermission('budget.view.full'),
  asyncHandler(async (req, res) => {
    const { from, to } = z
      .object({ from: z.coerce.number().default(1), to: z.coerce.number() })
      .parse(req.query);

    const projectOid = new mongoose.Types.ObjectId(req.projectId!);
    const [a, b] = await Promise.all([
      BudgetModel.findOne({ project_id: projectOid, version: from }).lean(),
      BudgetModel.findOne({ project_id: projectOid, version: to }).lean(),
    ]);
    if (!a || !b) throw badRequest('Una de las versiones no existe', 'VERSION_NOT_FOUND');

    const byCode = new Map(a.chapters.map((c) => [c.code, c]));
    res.json({
      success: true,
      data: {
        from: { version: a.version, total: a.total },
        to: { version: b.version, total: b.total },
        delta: b.total - a.total,
        chapters: b.chapters.map((c) => ({
          code: c.code,
          name: c.name,
          before: byCode.get(c.code)?.total ?? 0,
          after: c.total,
          delta: c.total - (byCode.get(c.code)?.total ?? 0),
        })),
      },
    });
  }),
);
