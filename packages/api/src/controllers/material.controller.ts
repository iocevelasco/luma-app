import type { NextFunction, Request, Response } from 'express';
import {
  bulkDeleteMaterialsSchema,
  bulkUpdateMaterialsSchema,
  createMaterialSchema,
  isMaterialEditable,
  supplierKey,
  updateMaterialSchema,
  type MaterialItem as MaterialDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { invoicesByMaterial } from './material-invoice.controller.js';
import { MaterialItem, type IMaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';
import { Provider, type IProvider } from '../models/Provider.js';
import { visibleProviderFilter } from '../services/directory.service.js';
import {
  badRequest,
  materialLocked,
  materialsLocked,
  notFound,
  unauthenticated,
} from '../utils/errors.js';

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

/** Lo que se le pide al proveedor vinculado para mostrarlo en la fila. */
const PROVIDER_FIELDS = 'name active';

/**
 * `provider` llega poblado (`name`, `active`) desde las lecturas, o como un
 * `ObjectId` suelto si alguien se olvidó del `populate`: en ese caso sale sólo
 * el id y la fila muestra "sin nombre" en vez de romperse.
 */
function providerFields(material: IMaterialItem): Pick<
  MaterialDTO,
  'providerId' | 'providerName' | 'providerActive'
> {
  const provider = material.provider as unknown;
  if (!provider) return { providerId: null };
  if (typeof provider === 'object' && provider !== null && 'name' in provider) {
    const doc = provider as Pick<IProvider, 'name' | 'active'> & { _id: unknown };
    return { providerId: String(doc._id), providerName: doc.name, providerActive: doc.active };
  }
  return { providerId: String(provider) };
}

/**
 * Un proveedor que este material puede tomar: de los que ve la obra
 * (`visibleProviderFilter`, la misma fuente que la pantalla de Proveedores) y
 * activo. Uno de otra Empresa u otra obra no existe para esta consulta.
 */
async function findLinkableProvider(providerId: string, project: IProject) {
  const provider = await Provider.findOne({
    _id: providerId,
    active: true,
    ...(await visibleProviderFilter(project)),
  });
  if (!provider) throw badRequest('Ese proveedor no está entre los proveedores de esta obra.');
  return provider;
}

/**
 * Vincular un texto viejo al directorio no es corregir el material: si decía
 * "800 Aluminio" a mano y se vincula a "800 Aluminio" del directorio, la
 * compra sigue siendo la misma. Por eso se permite aunque el material ya esté
 * bloqueado — es la única escritura de contenido que lo esquiva.
 */
function formalizesSupplier(material: IMaterialItem, provider: IProvider): boolean {
  const written = supplierKey(material.supplier);
  return !material.provider && written !== '' && written === supplierKey(provider.name);
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
    editable: isMaterialEditable(material),
    estimatedCost: viewerCanSeeDetail ? material.estimatedCost : undefined,
    ...providerFields(material),
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
  const materials = await MaterialItem.find({ project: project._id })
    .populate('provider', PROVIDER_FIELDS)
    .sort({ createdAt: -1 });

  // Las facturas, sólo para quien puede verlas: para el resto el campo no
  // viene, y no un arreglo vacío que diga "no tiene" cuando sí tiene.
  const canSeeInvoices = Boolean(req.can?.('material.invoice.read') || req.can?.('expense.read'));
  const invoices = canSeeInvoices
    ? await invoicesByMaterial(req, project._id, materials.map((material) => String(material._id)))
    : null;

  return res.json({
    success: true,
    data: {
      materials: materials.map((material) => ({
        ...toMaterialDTO(material, viewerCanSeeDetail),
        ...(invoices ? { invoices: invoices.get(String(material._id)) ?? [] } : {}),
      })),
    },
  });
});

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export const createMaterial = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = createMaterialSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { activityId, providerId, ...rest } = parsed.data;

  if (!(await activityBelongsToProject(activityId, project._id))) {
    throw badRequest('La tarea no pertenece a esta obra');
  }

  const provider = providerId ? await findLinkableProvider(providerId, project) : null;

  const created = await MaterialItem.create({
    ...rest,
    supplier: provider ? undefined : rest.supplier,
    provider: provider?._id ?? null,
    activity: activityId || null,
    project: project._id,
    createdBy: req.user.sub,
    ...(rest.status && rest.status !== 'pendiente'
      ? { statusChangedBy: req.user.sub, statusChangedAt: new Date() }
      : {}),
  });
  const material = await created.populate('provider', PROVIDER_FIELDS);

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

  const { activityId, status, providerId, ...content } = parsed.data;

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

  // Proveedor del directorio o texto: setear uno borra el otro.
  let formalizes = false;
  if (providerId === null) {
    $set.provider = null;
  } else if (providerId !== undefined) {
    const provider = await findLinkableProvider(providerId, project);
    $set.provider = provider._id;
    delete $set.supplier;
    $unset.supplier = '';
    formalizes = formalizesSupplier(existing, provider);
  }
  if (typeof $set.supplier === 'string') $set.provider = null;

  const contentFields = [...Object.keys($set), ...Object.keys($unset)];
  // Sólo vincular el texto que ya tenía: no es corregirlo (ver `formalizesSupplier`).
  const onlyLinking = formalizes && contentFields.every((f) => f === 'provider' || f === 'supplier');
  const changesContent = contentFields.length > 0 && !onlyLinking;

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
  ).populate('provider', PROVIDER_FIELDS);

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

/**
 * Los materiales de una acción en lote, todos de esta obra o ninguno. Un id de
 * otra obra no se ignora en silencio: quiere decir que la pantalla está
 * desactualizada o que alguien arma el request a mano, y en los dos casos
 * aplicar "lo que sí se pudo" es peor que no aplicar nada.
 */
async function findAllInProject(ids: string[], projectId: unknown) {
  const materials = await MaterialItem.find({ _id: { $in: ids }, project: projectId });
  if (materials.length !== ids.length) {
    throw notFound('Alguno de esos materiales ya no está en esta obra. Actualizá la lista.');
  }
  return materials;
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * El estado se puede cambiar siempre. El proveedor es contenido: todos tienen
 * que seguir editables —salvo los que sólo se formalizan, ver
 * `formalizesSupplier`— o no se toca ninguno (409 con `details.ids`). Los que
 * ya estaban en el estado pedido no se reescriben: `statusChangedAt` es
 * cuándo cambió, y reescribirlo mentiría.
 */
export const bulkUpdateMaterials = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = bulkUpdateMaterialsSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { ids, status, providerId } = parsed.data;
  const materials = await findAllInProject(ids, project._id);

  if (providerId !== undefined) {
    const provider = providerId ? await findLinkableProvider(providerId, project) : null;
    const locked = materials.filter(
      (material) =>
        !isMaterialEditable(material) && !(provider && formalizesSupplier(material, provider)),
    );
    if (locked.length > 0) {
      throw materialsLocked(
        locked.map((material) => String(material._id)),
        'update',
      );
    }
    await MaterialItem.updateMany(
      { _id: { $in: ids }, project: project._id },
      provider
        ? { $set: { provider: provider._id }, $unset: { supplier: '' } }
        : { $set: { provider: null } },
    );
  }

  if (status !== undefined) {
    await MaterialItem.updateMany(
      { _id: { $in: ids }, project: project._id, status: { $ne: status } },
      { $set: { status, statusChangedBy: req.user.sub, statusChangedAt: new Date() } },
    );
  }

  return res.json({ success: true, data: { materialIds: ids } });
});

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * Todo o nada: si uno solo salió de Pendiente, no se borra ninguno y
 * `details.ids` dice cuáles. Borrar "los que se podía" deja a la persona
 * adivinando qué quedó.
 *
 * El borrado va con el mismo `EDITABLE_FILTER` que el de a uno. Si un material
 * cambia de estado justo entre el chequeo y el `deleteMany`, ése se salva y el
 * resto se borra: es la única ventana de aplicación parcial, y deja del lado
 * seguro al que alguien acababa de mover.
 */
export const bulkDeleteMaterials = wrap(async (req, res) => {
  const parsed = bulkDeleteMaterialsSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const project = req.project as IProject;
  const { ids } = parsed.data;
  const materials = await findAllInProject(ids, project._id);

  const locked = materials.filter((material) => !isMaterialEditable(material));
  if (locked.length > 0) {
    throw materialsLocked(
      locked.map((material) => String(material._id)),
      'delete',
    );
  }

  await MaterialItem.deleteMany({ _id: { $in: ids }, project: project._id, ...EDITABLE_FILTER });

  return res.json({ success: true, data: { materialIds: ids } });
});

/** Una escritura condicional no matcheó: ¿bloqueado o inexistente? */
async function whyNotFound(materialId: unknown, projectId: unknown) {
  const stillThere = await MaterialItem.exists({ _id: materialId, project: projectId });
  return stillThere ? materialLocked() : notFound('No encontramos ese material.');
}
