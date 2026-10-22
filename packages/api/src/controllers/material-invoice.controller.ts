import type { NextFunction, Request, Response } from 'express';
import {
  createMaterialInvoiceSchema,
  type MaterialInvoiceRef,
} from '@luma/shared';
import { RECEIPT_MIME_TO_EXTENSION } from '../middleware/receipt-upload.middleware.js';
import { Expense, type IExpense } from '../models/Expense.js';
import { MaterialItem } from '../models/MaterialItem.js';
import type { IProject } from '../models/Project.js';
import { Provider } from '../models/Provider.js';
import { visibleProviderFilter } from '../services/directory.service.js';
import {
  deleteObject,
  signObjectUrl,
  StorageNotConfiguredError,
  uploadProjectDocument,
} from '../services/storage.service.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  unauthenticated,
} from '../utils/errors.js';

/**
 * Facturas de materiales, cargadas desde Compras.
 *
 * **Una factura es un gasto.** Se guarda como `Expense` de categoría
 * `material`, con los materiales que paga en `materials`: aparece en Finanzas
 * una sola vez y el total gastado sube exactamente su monto. No hay un modelo
 * de factura aparte, porque dos modelos para la misma plata la cuentan dos
 * veces (ver "Plata" en CLAUDE.md).
 *
 * Las rutas van con `material.invoice.*` y no con `expense.*`: el supervisor
 * carga la factura de lo que compró, pero no entra a Finanzas. Por eso este
 * controller sólo alcanza gastos de categoría `material` con materiales — un
 * gasto de nómina nunca sale por acá.
 */

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Express 4 no atrapa el `throw` de un handler async: va al `errorHandler` por `next`. */
function wrap(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

/** Lo que alcanza a una factura desde Compras: gasto de materiales de esta obra. */
const INVOICE_FILTER = { category: 'material', 'materials.0': { $exists: true } } as const;

/**
 * Corregirla es del gerente o el contador (`expense.write`, desde Finanzas).
 * Quien sólo tiene `material.invoice.write` borra la que cargó él y la vuelve
 * a cargar: no edita montos ajenos.
 */
function canDeleteInvoice(req: Request, expense: Pick<IExpense, 'registeredBy'>): boolean {
  return Boolean(req.can?.('expense.write')) || String(expense.registeredBy) === req.user?.sub;
}

export async function toInvoiceRef(req: Request, expense: IExpense): Promise<MaterialInvoiceRef> {
  return {
    id: String(expense._id),
    fileName: expense.receipt?.fileName ?? '',
    url: expense.receipt ? await signObjectUrl(expense.receipt.key) : null,
    canDelete: canDeleteInvoice(req, expense),
  };
}

/**
 * Las facturas de un conjunto de materiales, agrupadas por material. Para la
 * lista de Compras: una consulta, y una URL firmada por factura, no por fila.
 */
export async function invoicesByMaterial(
  req: Request,
  projectId: unknown,
  materialIds: string[],
): Promise<Map<string, MaterialInvoiceRef[]>> {
  const byMaterial = new Map<string, MaterialInvoiceRef[]>();
  if (materialIds.length === 0) return byMaterial;

  const expenses = await Expense.find({
    project: projectId,
    ...INVOICE_FILTER,
    materials: { $in: materialIds },
  }).sort({ spentOn: -1 });

  for (const expense of expenses) {
    const ref = await toInvoiceRef(req, expense);
    for (const materialId of expense.materials.map(String)) {
      byMaterial.set(materialId, [...(byMaterial.get(materialId) ?? []), ref]);
    }
  }
  return byMaterial;
}

/**
 * Requiere `requireProjectAccess` + `requireCapability('material.invoice.write')`.
 * Multipart con el archivo en `receipt`, obligatorio: una factura sin papel no
 * documenta nada.
 */
export const createMaterialInvoice = wrap(async (req, res) => {
  if (!req.user) throw unauthenticated();

  const parsed = createMaterialInvoiceSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

  const file = req.file;
  if (!file) throw badRequest('Adjuntá la factura: un PDF o una foto.');
  const extension = RECEIPT_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) throw badRequest('Formato no soportado. Subí un PDF o una imagen .jpg, .png o .webp.');

  const project = req.project as IProject;
  const { materialIds, providerId, markBought, ...money } = parsed.data;

  const materials = await MaterialItem.find({ _id: { $in: materialIds }, project: project._id });
  if (materials.length !== materialIds.length) {
    throw notFound('Alguno de esos materiales ya no está en esta obra. Actualizá la lista.');
  }

  // Un Pendiente no se compró: no tiene factura. Un Solicitado sí puede, si
  // quien la carga confirma que la compra se concretó (`markBought`).
  const pending = materials.filter((material) => material.status === 'pendiente');
  if (pending.length > 0) {
    throw conflict('Hay materiales que todavía no se pidieron: no pueden tener factura.', {
      ids: pending.map((material) => String(material._id)),
    });
  }
  const requested = materials.filter((material) => material.status === 'solicitado');
  if (requested.length > 0 && !markBought) {
    throw conflict('Hay materiales Solicitados: marcalos como comprados para cargarles la factura.', {
      ids: requested.map((material) => String(material._id)),
    });
  }

  let provider = null;
  if (providerId) {
    provider = await Provider.findOne({ _id: providerId, ...(await visibleProviderFilter(project)) });
    if (!provider) throw badRequest('Ese proveedor no está entre los proveedores de esta obra.');
  }

  // El archivo se sube después de validar: al revés, una factura rechazada
  // deja un comprobante huérfano en el bucket.
  let key: string;
  try {
    ({ key } = await uploadProjectDocument({
      projectId: String(project._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    }));
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw serviceUnavailable('La carga de comprobantes todavía no está configurada en este entorno.');
    }
    throw error;
  }

  const expense = await Expense.create({
    project: project._id,
    category: 'material',
    ...money,
    provider: provider?._id ?? null,
    materials: materialIds,
    receipt: {
      key,
      fileName: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
    },
    registeredBy: req.user.sub,
  });

  if (requested.length > 0) {
    await MaterialItem.updateMany(
      { _id: { $in: requested.map((material) => material._id) }, project: project._id, status: 'solicitado' },
      { $set: { status: 'comprado', statusChangedBy: req.user.sub, statusChangedAt: new Date() } },
    );
  }

  return res.status(201).json({
    success: true,
    data: { invoice: { ...(await toInvoiceRef(req, expense)), materialIds } },
  });
});

/**
 * Requiere `requireProjectAccess` + `requireCapability('material.invoice.write')`.
 * Borra el gasto y su archivo. Los materiales no vuelven de estado: que se
 * hayan comprado sigue siendo cierto aunque la factura estuviera mal.
 */
export const deleteMaterialInvoice = wrap(async (req, res) => {
  const project = req.project as IProject;
  const expense = await Expense.findOne({
    _id: req.params.expenseId,
    project: project._id,
    ...INVOICE_FILTER,
  });
  if (!expense) throw notFound('No encontramos esa factura.');
  if (!canDeleteInvoice(req, expense)) {
    throw forbidden('Sólo podés eliminar las facturas que cargaste vos.');
  }

  if (expense.receipt) await deleteObject(expense.receipt.key);
  await Expense.deleteOne({ _id: expense._id });

  return res.json({ success: true, data: { id: String(expense._id) } });
});
