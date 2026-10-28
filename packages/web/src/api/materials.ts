import type {
  ApiResponse,
  BulkDeleteMaterialsInput,
  BulkUpdateMaterialsInput,
  CreateMaterialInvoiceInput,
  MaterialBulkResponse,
  MaterialInvoiceResponse,
  CreateMaterialInput,
  MaterialListResponse,
  MaterialResponse,
  UpdateMaterialInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/projects.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const materialsApi = {
  list: (projectId: string) =>
    unwrap<MaterialListResponse>(apiClient.get(`/api/projects/${projectId}/materials`)),

  create: (projectId: string, payload: CreateMaterialInput) =>
    unwrap<MaterialResponse>(apiClient.post(`/api/projects/${projectId}/materials`, payload)),

  update: (projectId: string, materialId: string, payload: UpdateMaterialInput) =>
    unwrap<MaterialResponse>(
      apiClient.patch(`/api/projects/${projectId}/materials/${materialId}`, payload),
    ),

  remove: (projectId: string, materialId: string) =>
    unwrap<{ materialId: string }>(
      apiClient.delete(`/api/projects/${projectId}/materials/${materialId}`),
    ),

  bulkUpdate: (projectId: string, payload: BulkUpdateMaterialsInput) =>
    unwrap<MaterialBulkResponse>(
      apiClient.patch(`/api/projects/${projectId}/materials/bulk`, payload),
    ),

  /** Multipart: la foto va en `photo`. Agrega o reemplaza. */
  uploadPhoto: (projectId: string, materialId: string, photo: File) => {
    const formData = new FormData();
    formData.append('photo', photo);
    return unwrap<MaterialResponse>(
      apiClient.post(`/api/projects/${projectId}/materials/${materialId}/photo`, formData),
    );
  },

  /**
   * Los bytes de la foto, servidos por la API (la URL firmada es de otro
   * dominio y no se puede dibujar). `version` va en la URL: esa URL es siempre
   * la misma foto, y por eso el navegador puede guardarla sin que un
   * reemplazo le devuelva la vieja.
   */
  photo: (projectId: string, materialId: string, version: string) =>
    apiClient.getBlob(
      `/api/projects/${projectId}/materials/${materialId}/photo?v=${encodeURIComponent(version)}`,
    ),

  removePhoto: (projectId: string, materialId: string) =>
    unwrap<MaterialResponse>(
      apiClient.delete(`/api/projects/${projectId}/materials/${materialId}/photo`),
    ),

  /** Multipart: el archivo de la factura va en `receipt`, como en el alta de gasto. */
  createInvoice: (projectId: string, payload: CreateMaterialInvoiceInput, receipt: File) => {
    const formData = new FormData();
    formData.append('receipt', receipt);
    formData.append('materialIds', payload.materialIds.join(','));
    formData.append('amount', String(payload.amount));
    formData.append('currency', payload.currency);
    formData.append('exchangeRate', String(payload.exchangeRate));
    formData.append('spentOn', payload.spentOn);
    formData.append('description', payload.description);
    formData.append('markBought', String(payload.markBought));
    if (payload.providerId) formData.append('providerId', payload.providerId);
    if (payload.notes) formData.append('notes', payload.notes);
    return unwrap<MaterialInvoiceResponse>(
      apiClient.post(`/api/projects/${projectId}/materials/invoices`, formData),
    );
  },

  deleteInvoice: (projectId: string, invoiceId: string) =>
    unwrap<{ id: string }>(
      apiClient.delete(`/api/projects/${projectId}/materials/invoices/${invoiceId}`),
    ),

  bulkRemove: (projectId: string, payload: BulkDeleteMaterialsInput) =>
    unwrap<MaterialBulkResponse>(
      apiClient.post(`/api/projects/${projectId}/materials/bulk/delete`, payload),
    ),
};
