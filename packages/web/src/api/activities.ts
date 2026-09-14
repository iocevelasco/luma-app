import type {
  ActivityListResponse,
  ActivityResponse,
  ApiResponse,
  CreateActivityInput,
  UpdateActivityInput,
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

export const activitiesApi = {
  list: (projectId: string, range?: { from: string; to: string }) => {
    const query = range ? `?from=${range.from}&to=${range.to}` : '';
    return unwrap<ActivityListResponse>(
      apiClient.get(`/api/projects/${projectId}/activities${query}`),
    );
  },

  create: (projectId: string, payload: CreateActivityInput) =>
    unwrap<ActivityResponse>(
      apiClient.post(`/api/projects/${projectId}/activities`, payload),
    ),

  update: (projectId: string, activityId: string, payload: UpdateActivityInput) =>
    unwrap<ActivityResponse>(
      apiClient.patch(`/api/projects/${projectId}/activities/${activityId}`, payload),
    ),

  remove: (projectId: string, activityId: string) =>
    unwrap<{ activityId: string }>(
      apiClient.delete(`/api/projects/${projectId}/activities/${activityId}`),
    ),
};
