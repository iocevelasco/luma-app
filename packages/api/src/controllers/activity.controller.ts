import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { createActivitySchema, updateActivitySchema, type Activity as ActivityDTO } from '@luma/shared';
import { Activity, type IActivity } from '../models/Activity.js';
import { MaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toActivityDTO(activity: IActivity): ActivityDTO {
  return {
    id: String(activity._id),
    projectId: String(activity.project),
    name: activity.name,
    area: activity.area,
    startDate: activity.startDate,
    endDate: activity.endDate,
    responsible: {
      name: activity.responsible.name,
      user: activity.responsible.user ? String(activity.responsible.user) : undefined,
    },
    status: activity.status,
    notes: activity.notes,
    createdBy: String(activity.createdBy),
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

/** Requiere `requireProjectAccess` antes. Acepta `from`/`to` (`YYYY-MM-DD`) como rango solapado. */
export async function listActivities(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { from, to } = req.query as { from?: string; to?: string };

    const filter: Record<string, unknown> = { project: project._id };
    if (from) filter.endDate = { $gte: from };
    if (to) filter.startDate = { ...(filter.startDate as object), $lte: to };

    const activities = await Activity.find(filter).sort({ startDate: 1 });

    return res.json({ success: true, data: { activities: activities.map(toActivityDTO) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] listActivities:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function createActivity(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;

    const activity = await Activity.create({
      ...parsed.data,
      project: project._id,
      createdBy: req.user.sub,
    });

    return res.status(201).json({ success: true, data: { activity: toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] createActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function updateActivity(req: Request, res: Response) {
  try {
    const parsed = updateActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.activityId, project: project._id },
      parsed.data,
      { new: true },
    );

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    return res.json({ success: true, data: { activity: toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] updateActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Borrado
 * DURO. Los `MaterialItem` asociados quedan con `activity: null` en vez de
 * borrarse en cascada.
 */
export async function deleteActivity(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    await MaterialItem.updateMany({ activity: activity._id }, { activity: null });
    await Activity.findByIdAndDelete(activity._id);

    return res.json({ success: true, data: { activityId: String(activity._id) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] deleteActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}
