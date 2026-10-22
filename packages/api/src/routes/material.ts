import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  handleReceiptUploadError,
  receiptUpload,
} from '../middleware/receipt-upload.middleware.js';
import {
  bulkDeleteMaterials,
  bulkUpdateMaterials,
  createMaterial,
  createMaterialInvoice,
  deleteMaterial,
  deleteMaterialInvoice,
  listMaterials,
  updateMaterial,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/materials` — ver routes/project.ts.
 * `material.write`: el supervisor registra materiales y herramientas, es el
 * principal generador de datos del sistema. La lectura es interna — las
 * "fotos de compras" que la matriz le promete al cliente son otra superficie,
 * todavía sin construir, y no este inventario.
 */
export const materialRouter = Router({ mergeParams: true });

materialRouter.use(isAuthenticated, requireProjectAccess);

materialRouter.get('/', requireCapability('material.read'), listMaterials);
materialRouter.post('/', requireCapability('material.write'), createMaterial);
// Antes de `/:materialId`: si no, "bulk" se lee como un id. El borrado en
// lote es un POST porque un DELETE con body se pierde en algunos proxies.
materialRouter.patch('/bulk', requireCapability('material.write'), bulkUpdateMaterials);
materialRouter.post('/bulk/delete', requireCapability('material.write'), bulkDeleteMaterials);
// Facturas: un gasto, pero con su propia capacidad. Ver material-invoice.controller.ts.
materialRouter.post(
  '/invoices',
  requireCapability('material.invoice.write'),
  receiptUpload.single('receipt'),
  handleReceiptUploadError,
  createMaterialInvoice,
);
materialRouter.delete(
  '/invoices/:expenseId',
  requireCapability('material.invoice.write'),
  deleteMaterialInvoice,
);
materialRouter.patch('/:materialId', requireCapability('material.write'), updateMaterial);
materialRouter.delete('/:materialId', requireCapability('material.write'), deleteMaterial);

export default materialRouter;
