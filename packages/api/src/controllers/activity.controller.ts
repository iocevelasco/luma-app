import type { Request, Response } from 'express';
import mongoose from 'mongoose';
// Import de sólo-tipos: activa la ampliación de `Express.Request.file` que
// trae `@types/multer`, aunque este archivo no llame a multer directamente
// (el middleware vive en la ruta).
import type {} from 'multer';
import {
  createActivitySchema,
  updateActivitySchema,
  type Activity as ActivityDTO,
  type ActivityEvidencePhoto,
} from '@luma/shared';
import { Activity, type IActivity } from '../models/Activity.js';
import { MaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';
import {
  StorageNotConfiguredError,
  deleteEvidencePhoto,
  signEvidencePhotoUrl,
  uploadEvidencePhoto,
} from '../services/storage.service.js';

const EVIDENCE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * Firma cada `key` de evidencia al vuelo — nunca se guarda ni se cachea la
 * URL, sólo el `key` interno. Una foto sin storage configurado (`null`)
 * simplemente se omite en vez de romper toda la respuesta.
 */
async function toActivityDTO(activity: IActivity): Promise<ActivityDTO> {
  const signedEvidence = await Promise.all(
    activity.evidence.map(async (photo): Promise<ActivityEvidencePhoto | null> => {
      const url = await signEvidencePhotoUrl(photo.key);
      if (!url) return null;
      return {
        id: String(photo._id),
        url,
        uploadedBy: String(photo.uploadedBy),
        uploadedAt: photo.uploadedAt.toISOString(),
      };
    }),
  );

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
    evidence: signedEvidence.filter((photo): photo is ActivityEvidencePhoto => photo !== null),
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

    return res.json({
      success: true,
      data: { activities: await Promise.all(activities.map(toActivityDTO)) },
    });
  } catch (error) {
    console.error('❌ [ACTIVITY] listActivities:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
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

    return res
      .status(201)
      .json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] createActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
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

    return res.json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] updateActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Borrado
 * DURO. Los `MaterialItem` asociados quedan con `activity: null` en vez de
 * borrarse en cascada. La evidencia fotográfica sí se borra del storage acá
 * — sin este paso, cada actividad borrada deja fotos huérfanas pagándose
 * solas en el bucket para siempre.
 */
export async function deleteActivity(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    await Promise.all(activity.evidence.map((photo) => deleteEvidencePhoto(photo.key)));
    await MaterialItem.updateMany({ activity: activity._id }, { activity: null });
    await Activity.findByIdAndDelete(activity._id);

    return res.json({ success: true, data: { activityId: String(activity._id) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] deleteActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Multipart
 * con un único campo `photo` (`upload.single('photo')` en la ruta).
 */
export async function uploadActivityEvidence(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Falta la foto' });
  }

  const extension = EVIDENCE_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) {
    return res
      .status(400)
      .json({ success: false, error: 'Formato no soportado. Subí una foto .jpg, .png o .webp' });
  }

  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const { key } = await uploadEvidencePhoto({
      projectId: String(project._id),
      activityId: String(activity._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    });

    activity.evidence.push({ key, uploadedBy: req.user.sub, uploadedAt: new Date() });
    await activity.save();

    return res
      .status(201)
      .json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return res.status(503).json({
        success: false,
        error: 'El registro fotográfico todavía no está configurado en esta obra',
      });
    }
    console.error('❌ [ACTIVITY] uploadActivityEvidence:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function deleteActivityEvidence(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const photo = activity.evidence.id(req.params.evidenceId);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Foto no encontrada' });
    }

    await deleteEvidencePhoto(photo.key);
    photo.deleteOne();
    await activity.save();

    return res.json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] deleteActivityEvidence:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}
