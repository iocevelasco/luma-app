import type { Request, Response } from 'express';
import { createMaterialSchema, updateMaterialSchema, type MaterialItem as MaterialDTO } from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { MaterialItem, type IMaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * `viewerCanSeeDetail` en `false` saca `estimatedCost` — el cliente invitado
 * ve estado y avance, no el detalle de costos internos (regla 13, la misma
 * que rige el presupuesto). El dueño y el Asistente de Obra sí lo ven: es
 * quien lo carga. El resto del ítem sí es visible para todos: cantidad y
 * estado son lo que necesita el cliente para entender qué falta.
 */
function toMaterialDTO(material: IMaterialItem, viewerCanSeeDetail: boolean): MaterialDTO {
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
    estimatedCost: viewerCanSeeDetail ? material.estimatedCost : undefined,
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
    const viewerCanSeeDetail = Boolean(req.isProjectEditor);
    const materials = await MaterialItem.find({ project: project._id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: { materials: materials.map((material) => toMaterialDTO(material, viewerCanSeeDetail)) },
    });
  } catch (error) {
    console.error('❌ [MATERIAL] listMaterials:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
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

    // Requiere `requireProjectEditor` — quien la llama siempre puede ver el
    // detalle completo de lo que acaba de crear.
    return res.status(201).json({ success: true, data: { material: toMaterialDTO(material, true) } });
  } catch (error) {
    console.error('❌ [MATERIAL] createMaterial:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
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

    // Requiere `requireProjectEditor` — quien la llama siempre puede ver el
    // detalle completo de lo que acaba de actualizar.
    return res.json({
      success: true,
      data: { material: toMaterialDTO(material as IMaterialItem, true) },
    });
  } catch (error) {
    console.error('❌ [MATERIAL] updateMaterial:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. Borrado DURO. */
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
