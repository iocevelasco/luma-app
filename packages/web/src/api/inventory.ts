import type {
  ApiResponse,
  CreateStockMovementInput,
  StockListResponse,
  StockMovementListResponse,
  StockMovementQuery,
  StockMovementResponse,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/materials.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const inventoryApi = {
  /** Lo que hay hoy en el patio, recalculado por la API. */
  stock: (projectId: string) =>
    unwrap<StockListResponse>(apiClient.get(`/api/projects/${projectId}/inventory/stock`)),

  /** El kardex, con los filtros que lleguen. */
  movements: (projectId: string, filters: StockMovementQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return unwrap<StockMovementListResponse>(
      apiClient.get(`/api/projects/${projectId}/inventory/movements${query ? `?${query}` : ''}`),
    );
  },

  createMovement: (projectId: string, payload: CreateStockMovementInput) =>
    unwrap<StockMovementResponse>(
      apiClient.post(`/api/projects/${projectId}/inventory/movements`, payload),
    ),
};
