import type {
  ApiResponse,
  BudgetResponse,
  CreateBudgetInput,
  CreateBudgetResponse,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/labor.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const budgetApi = {
  get: (projectId: string) =>
    unwrap<BudgetResponse>(apiClient.get(`/api/projects/${projectId}/budget`)),

  create: (projectId: string, payload: CreateBudgetInput) =>
    unwrap<CreateBudgetResponse>(apiClient.post(`/api/projects/${projectId}/budget`, payload)),
};
