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
import { MATERIAL_PHOTO_MIME_TO_EXTENSION } from '../middleware/material-photo-upload.middleware.js';
import { visibleProviderFilter } from '../services/directory.service.js';
import {
  deleteObject,
  readObject,
  signObjectUrl,
  StorageNotConfiguredError,
  uploadMaterialPhoto as storeMaterialPhoto,
} from '../services/storage.service.js';
import {
  badRequest,
  materialLocked,
  materialsLocked,
  notFound,
  serviceUnavailable,
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
function toMaterialDTO(
  material: IMaterialItem,
  viewerCanSeeDetail: boolean,
  photoUrl: string | null = null,
): MaterialDTO {
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
    photoUrl,
    ...providerFields(material),
    supplier: material.supplier,
    createdBy: String(material.createdBy),
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

/**
 * La URL firmada de la foto, o `null`. Un media-service caído o un archivo que
 * ya no está no tienen que voltear la lista de Compras entera: la fila sale
 * sin foto.
 */
async function signedPhotoUrl(material: IMaterialItem): Promise<string | null> {
  if (!material.photo) return null;
  try {
    return await signObjectUrl(material.photo.key);
  } catch (error) {
    console.error('❌ [MATERIAL] no se pudo firmar la foto:', error);
    return null;
  }
}

/** Borrar el archivo es limpieza: si falla, el material ya quedó bien y sólo sobra un archivo. */
async function discardPhotoFile(key: string): Promise<void> {
  try {
    await deleteObject(key);
  } catch (error) {
    console.error('❌ [MATERIAL] no se pudo borrar la foto:', error);
  }
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
  const viewerCanSeeDetail = Boolean(req.can?.('material.cost.read'));
  const materials = await MaterialItem.find({ project: project._id })
    .populate('provider', PROVIDER_FIELDS)
    .sort({ createdAt: -1 });

  // Las facturas, sólo para quien puede verlas: para el resto el campo no
  // viene, y no un arreglo vacío que diga "no tiene" cuando sí tiene.
  const canSeeInvoices = Boolean(req.can?.('material.invoice.read') || req.can?.('expense.read'));
  const invoices = canSeeInvoices
    ? await invoicesByMaterial(req, project._id, materials.map((material) => String(material._id)))
    : null;

  const photoUrls = await Promise.all(materials.map(signedPhotoUrl));

  return res.json({
    success: true,
    data: {
      materials: materials.map((material, index) => ({
        ...toMaterialDTO(material, viewerCanSeeDetail, photoUrls[index]),
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
  return res.json({
    success: true,
    data: { material: toMaterialDTO(material, true, await signedPhotoUrl(material)) },
  });
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('material.write')`.
 * Multipart con la foto en `photo`. Agrega o reemplaza, en cualquier estado:
 * la foto llega a veces cuando el material ya se pidió (alguien la manda por
 * WhatsApp), y bloquearla acá sería frenar justo el caso para el que existe.
 */
export const uploadMaterialPhoto = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const file = req.file;
  if (!file) throw badRequest('Falta la foto.');
  const extension = MATERIAL_PHOTO_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) throw badRequest('Formato no soportado. Subí una foto .jpg, .png o .webp.');

  const project = req.project as IProject;
  const existing = await MaterialItem.findOne({
    _id: req.params.materialId,
    project: project._id,
  });
  if (!existing) throw notFound('No encontramos ese material.');

  let key: string;
  try {
    ({ key } = await storeMaterialPhoto({
      projectId: String(project._id),
      materialId: String(existing._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    }));
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw serviceUnavailable('La carga de fotos todavía no está configurada en este entorno.');
    }
    throw error;
  }

  const material = await MaterialItem.findOneAndUpdate(
    { _id: existing._id, project: project._id },
    {
      $set: {
        photo: {
          key,
          contentType: file.mimetype,
          uploadedBy: req.user.sub,
          uploadedAt: new Date(),
        },
      },
    },
    { new: true },
  ).populate('provider', PROVIDER_FIELDS);

  // Lo borraron entre la lectura y la escritura: la foto quedó sin dueño.
  if (!material) {
    await discardPhotoFile(key);
    throw notFound('No encontramos ese material.');
  }

  if (existing.photo) await discardPhotoFile(existing.photo.key);

  return res.status(201).json({
    success: true,
    data: { material: toMaterialDTO(material, true, await signedPhotoUrl(material)) },
  });
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('material.read')`. Los
 * bytes de la foto, servidos por la API: la lista de compras exportada (PDF y
 * compartir) la dibuja en el navegador, y una URL firmada de otro dominio no
 * se puede leer ahí. Pasa por el mismo permiso que la lista: quien ve el
 * material ve su foto, y nadie más.
 */
export const getMaterialPhoto = wrap(async (req, res) => {
  const project = req.project as IProject;
  const material = await MaterialItem.findOne({
    _id: req.params.materialId,
    project: project._id,
  });
  if (!material?.photo) throw notFound('Ese material no tiene foto.');

  let file;
  try {
    file = await readObject(material.photo.key);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw serviceUnavailable('La carga de fotos todavía no está configurada en este entorno.');
    }
    throw error;
  }
  if (!file) throw notFound('Ese material no tiene foto.');

  // La foto cambia sólo si se reemplaza, y el navegador la pide con su
  // `updatedAt` en la caché propia de la pantalla: acá alcanza con no
  // compartirla entre usuarios.
  res.set('Cache-Control', 'private, max-age=300');
  res.type(material.photo.contentType);
  return res.send(file.buffer);
});

/** Requiere `requireProjectAccess` + `requireCapability('material.write')`. Idempotente. */
export const deleteMaterialPhoto = wrap(async (req, res) => {
  const project = req.project as IProject;
  const existing = await MaterialItem.findOne({
    _id: req.params.materialId,
    project: project._id,
  });
  if (!existing) throw notFound('No encontramos ese material.');

  const material = await MaterialItem.findOneAndUpdate(
    { _id: existing._id, project: project._id },
    { $unset: { photo: '' } },
    { new: true },
  ).populate('provider', PROVIDER_FIELDS);
  if (!material) throw notFound('No encontramos ese material.');

  if (existing.photo) await discardPhotoFile(existing.photo.key);

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

  if (material.photo) await discardPhotoFile(material.photo.key);

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

  // Las fotos de los que de verdad se borraron: uno que se salvó por la
  // ventana de arriba conserva la suya.
  const withPhoto = materials.filter((material) => material.photo);
  if (withPhoto.length > 0) {
    const survivors = new Set(
      (await MaterialItem.find({ _id: { $in: ids }, project: project._id }).distinct('_id')).map(String),
    );
    await Promise.all(
      withPhoto
        .filter((material) => !survivors.has(String(material._id)))
        .map((material) => discardPhotoFile(material.photo!.key)),
    );
  }

  return res.json({ success: true, data: { materialIds: ids } });
});

/** Una escritura condicional no matcheó: ¿bloqueado o inexistente? */
async function whyNotFound(materialId: unknown, projectId: unknown) {
  const stillThere = await MaterialItem.exists({ _id: materialId, project: projectId });
  return stillThere ? materialLocked() : notFound('No encontramos ese material.');
}
