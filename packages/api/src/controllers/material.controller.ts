import type { Request, Response } from 'express';
import { createMaterialSchema, updateMaterialSchema, type MaterialItem as MaterialDTO } from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { MaterialItem, type IMaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toMaterialDTO(material: IMaterialItem): MaterialDTO {
  return {
    id: String(material._id),
    projectId: String(material.project),
    activityId: material.activity ? String(material.activity) : null,
    name: material.name,
    quantity: material.quantity,
    unit: material.unit,
    status: material.status,
    statusChangedBy: material.statusChangedBy ? String(material.statusChangedBy) : undefined,
    statusChangedAt: material.statusChangedAt ? material.statusChangedAt.toISOString() : undefined,
    estimatedCost: material.estimatedCost,
    supplier: material.supplier,
    createdBy: String(material.createdBy),
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

/**
 * Confirma que `activityId` (si viene) es una actividad de esa misma obra.
 * Necesita ir a la base, por eso no vive en el schema Zod.
 */
async function activityBelongsToProject(
  activityId: string | null | undefined,
  projectId: unknown,
): Promise<boolean> {
  if (!activityId) return true;
  const activity = await Activity.findOne({ _id: activityId, project: projectId });
  return Boolean(activity);
}

/** Requiere `requireProjectAccess` antes. */
export async function listMaterials(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const materials = await MaterialItem.find({ project: project._id }).sort({ createdAt: -1 });

    return res.json({ success: true, data: { materials: materials.map(toMaterialDTO) } });
  } catch (error) {
    console.error('❌ [MATERIAL] listMaterials:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function createMaterial(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { activityId, ...rest } = parsed.data;

    if (!(await activityBelongsToProject(activityId, project._id))) {
      return res
        .status(400)
        .json({ success: false, error: 'La actividad no pertenece a esta obra' });
    }

    const material = await MaterialItem.create({
      ...rest,
      activity: activityId || null,
      project: project._id,
      createdBy: req.user.sub,
      ...(rest.status && rest.status !== 'pendiente'
        ? { statusChangedBy: req.user.sub, statusChangedAt: new Date() }
        : {}),
    });

    return res.status(201).json({ success: true, data: { material: toMaterialDTO(material) } });
  } catch (error) {
    console.error('❌ [MATERIAL] createMaterial:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function updateMaterial(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = updateMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const existing = await MaterialItem.findOne({
      _id: req.params.materialId,
      project: project._id,
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Material no encontrado' });
    }

    const { activityId, ...rest } = parsed.data;

    if (activityId !== undefined && !(await activityBelongsToProject(activityId, project._id))) {
      return res
        .status(400)
        .json({ success: false, error: 'La actividad no pertenece a esta obra' });
    }

    const update: Record<string, unknown> = { ...rest };
    if (activityId !== undefined) update.activity = activityId || null;

    // `statusChangedBy`/`statusChangedAt` los setea el server, comparando el
    // valor previo contra el nuevo — el cliente nunca los manda.
    if (rest.status && rest.status !== existing.status) {
      update.statusChangedBy = req.user.sub;
      update.statusChangedAt = new Date();
    }

    const material = await MaterialItem.findByIdAndUpdate(existing._id, update, { new: true });

    return res.json({ success: true, data: { material: toMaterialDTO(material as IMaterialItem) } });
  } catch (error) {
    console.error('❌ [MATERIAL] updateMaterial:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. Borrado DURO. */
export async function deleteMaterial(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const material = await MaterialItem.findOneAndDelete({
      _id: req.params.materialId,
      project: project._id,
    });

    if (!material) {
      return res.status(404).json({ success: false, error: 'Material no encontrado' });
    }

    return res.json({ success: true, data: { materialId: String(material._id) } });
  } catch (error) {
    console.error('❌ [MATERIAL] deleteMaterial:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
