import type {
  ApiResponse,
  CreateStockMovementInput,
  DepositOverviewResponse,
  DepositResponse,
  ImportFromDepositInput,
  SendToDepositInput,
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

  /** Lo que hay en el Depósito General de la Empresa, para importar a esta obra. */
  deposit: (projectId: string) =>
    unwrap<DepositResponse>(apiClient.get(`/api/projects/${projectId}/inventory/deposit`)),

  sendToDeposit: (projectId: string, payload: SendToDepositInput) =>
    unwrap<StockMovementResponse>(
      apiClient.post(`/api/projects/${projectId}/inventory/deposit/send`, payload),
    ),

  importFromDeposit: (projectId: string, payload: ImportFromDepositInput) =>
    unwrap<{ movements: StockMovementListResponse['movements'] }>(
      apiClient.post(`/api/projects/${projectId}/inventory/deposit/import`, payload),
    ),

  /** La pantalla de la Empresa: líneas, historial y ahorro por reutilización. */
  myDeposit: () => unwrap<DepositOverviewResponse>(apiClient.get('/api/organizations/me/deposit')),
};
