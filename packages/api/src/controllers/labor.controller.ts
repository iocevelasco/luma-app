import type { Request, Response } from 'express';
import { laborRecordSchema, type LaborRecord as LaborRecordDTO } from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { LaborRecord, type ILaborRecord } from '../models/LaborRecord.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * `viewerIsOwner` en `false` vacía `presentNames` — regla de negocio: el
 * cliente invitado no ve "la asignación individual de personal". `presentCount`
 * sale siempre de `record.presentNames.length` real, para que el dashboard no
 * reporte 0 presentes sólo porque quien mira es el cliente.
 */
function toLaborRecordDTO(record: ILaborRecord, viewerIsOwner: boolean): LaborRecordDTO {
  return {
    id: String(record._id),
    projectId: String(record.project),
    activityId: String(record.activity),
    date: record.date,
    expectedCount: record.expectedCount,
    presentNames: viewerIsOwner ? record.presentNames : [],
    presentCount: record.presentNames.length,
    createdBy: String(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Requiere `requireProjectAccess` antes. Acepta `date` (`YYYY-MM-DD`) para acotar a un día. */
export async function listLaborRecords(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { date } = req.query as { date?: string };
    const viewerIsOwner = Boolean(req.isProjectOwner);

    const filter: Record<string, unknown> = { project: project._id };
    if (date) filter.date = date;

    const records = await LaborRecord.find(filter).sort({ date: -1 });

    return res.json({
      success: true,
      data: { laborRecords: records.map((record) => toLaborRecordDTO(record, viewerIsOwner)) },
    });
  } catch (error) {
    console.error('❌ [LABOR] listLaborRecords:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Upsert por
 * (activity, date) — ver LaborRecord.ts. `createdBy` sólo se fija al crear,
 * nunca se pisa en una actualización posterior del mismo día.
 */
export async function upsertLaborRecord(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = laborRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { activityId, date, expectedCount, presentNames } = parsed.data;

    const activity = await Activity.findOne({ _id: activityId, project: project._id });
    if (!activity) {
      return res
        .status(400)
        .json({ success: false, error: 'La actividad no pertenece a esta obra' });
    }

    const record = await LaborRecord.findOneAndUpdate(
      { project: project._id, activity: activityId, date },
      {
        $set: { expectedCount, presentNames },
        $setOnInsert: { project: project._id, activity: activityId, date, createdBy: req.user.sub },
      },
      { new: true, upsert: true },
    );

    // Esta ruta requiere `requireProjectOwner` — quien la llama siempre es el dueño.
    return res
      .status(200)
      .json({ success: true, data: { laborRecord: toLaborRecordDTO(record, true) } });
  } catch (error) {
    console.error('❌ [LABOR] upsertLaborRecord:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
