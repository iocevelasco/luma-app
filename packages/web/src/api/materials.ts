import type {
  ApiResponse,
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
};
