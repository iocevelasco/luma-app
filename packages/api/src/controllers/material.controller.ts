import type { NextFunction, Request, Response } from 'express';
import {
  createMaterialSchema,
  isMaterialEditable,
  updateMaterialSchema,
  type MaterialItem as MaterialDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { MaterialItem, type IMaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';
import { badRequest, materialLocked, notFound, unauthenticated } from '../utils/errors.js';

type Handler = (req: Request, res: Response) => Promise<unknown>;

/**
 * Express 4 no atrapa el `throw` de un handler async: sin esto el request
 * queda colgado. Todo error va por `next(error)` al `errorHandler`, que le da
 * la forma `{ success, error, code }`.
 */
function wrap(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Lo que un material tiene que cumplir para corregirse (editar o eliminar).
 * La regla vive en `isMaterialEditable`; este filtro es la misma regla en
 * forma de consulta, para que la escritura sea atómica: `statusChangedAt: null`
 * también matchea "ausente". Con un `findOne` y después el `update` suelto, un
 * cambio de estado que llega en el medio se pisaría.
 */
const EDITABLE_FILTER = { status: 'pendiente', statusChangedAt: null } as const;

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
    editable: isMaterialEditable(material),
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
export const listMaterials = wrap(async (req, res) => {
  const project = req.project as IProject;
  const viewerCanSeeDetail = Boolean(req.can?.('material.write'));
  const materials = await MaterialItem.find({ project: project._id }).sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: { materials: materials.map((material) => toMaterialDTO(material, viewerCanSeeDetail)) },
  });
});

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export const createMaterial = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = createMaterialSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { activityId, ...rest } = parsed.data;

  if (!(await activityBelongsToProject(activityId, project._id))) {
    throw badRequest('La tarea no pertenece a esta obra');
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

  // Exige una capacidad de escritura — quien la llama siempre puede ver el
  // detalle completo de lo que acaba de crear.
  return res.status(201).json({ success: true, data: { material: toMaterialDTO(material, true) } });
});

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * Cambiar sólo el `status` se permite siempre: es el camino de la compra. Tocar
 * cualquier otro campo exige que el material siga sin moverse de Pendiente
 * (`isMaterialEditable`); si no, `MATERIAL_LOCKED`.
 */
export const updateMaterial = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = updateMaterialSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const existing = await MaterialItem.findOne({
    _id: req.params.materialId,
    project: project._id,
  });
  if (!existing) throw notFound('No encontramos ese material.');

  const { activityId, status, ...content } = parsed.data;

  if (activityId !== undefined && !(await activityBelongsToProject(activityId, project._id))) {
    throw badRequest('La tarea no pertenece a esta obra');
  }

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};

  for (const [field, value] of Object.entries(content)) {
    if (value === undefined) continue;
    // `null` —o un texto vacío— saca el campo en vez de dejarlo en blanco.
    if (value === null || value === '') $unset[field] = '';
    else $set[field] = value;
  }
  if (activityId !== undefined) $set.activity = activityId || null;

  const changesContent = Object.keys($set).length > 0 || Object.keys($unset).length > 0;

  if (changesContent && !isMaterialEditable(existing)) throw materialLocked();

  // `statusChangedBy`/`statusChangedAt` los setea el server, comparando el
  // valor previo contra el nuevo — el cliente nunca los manda.
  if (status !== undefined) {
    $set.status = status;
    if (status !== existing.status) {
      $set.statusChangedBy = req.user.sub;
      $set.statusChangedAt = new Date();
    }
  }

  const material = await MaterialItem.findOneAndUpdate(
    {
      _id: existing._id,
      project: project._id,
      ...(changesContent ? EDITABLE_FILTER : {}),
    },
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
    },
    { new: true },
  );

  // No matcheó: o se movió de estado entre la lectura y la escritura, o lo
  // borraron. Se vuelve a mirar para decir cuál de las dos.
  if (!material) throw await whyNotFound(existing._id, project._id);

  // Exige una capacidad de escritura — quien la llama siempre puede ver el
  // detalle completo de lo que acaba de actualizar.
  return res.json({ success: true, data: { material: toMaterialDTO(material, true) } });
});

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 * Borrado DURO, y sólo de un material sin mover de Pendiente: ningún gasto,
 * compromiso ni hito lo referencia, así que no deja nada colgando.
 */
export const deleteMaterial = wrap(async (req, res) => {
  const project = req.project as IProject;
  const material = await MaterialItem.findOneAndDelete({
    _id: req.params.materialId,
    project: project._id,
    ...EDITABLE_FILTER,
  });

  if (!material) throw await whyNotFound(req.params.materialId, project._id);

  return res.json({ success: true, data: { materialId: String(material._id) } });
});

/** Una escritura condicional no matcheó: ¿bloqueado o inexistente? */
async function whyNotFound(materialId: unknown, projectId: unknown) {
  const stillThere = await MaterialItem.exists({ _id: materialId, project: projectId });
  return stillThere ? materialLocked() : notFound('No encontramos ese material.');
}
