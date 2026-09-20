import type { ApiResponse, LaborRecordInput, LaborRecordListResponse, LaborRecordResponse } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/activities.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const laborApi = {
  list: (projectId: string, date?: string) => {
    const query = date ? `?date=${date}` : '';
    return unwrap<LaborRecordListResponse>(
      apiClient.get(`/api/projects/${projectId}/labor${query}`),
    );
  },

  upsert: (projectId: string, payload: LaborRecordInput) =>
    unwrap<LaborRecordResponse>(apiClient.post(`/api/projects/${projectId}/labor`, payload)),
};
