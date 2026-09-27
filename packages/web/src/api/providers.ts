import type {
  ApiResponse,
  ActivityProvidersResponse,
  AssignProviderInput,
  CreateProviderInput,
  ProviderListResponse,
  ProviderResponse,
  UpdateProviderInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/activities.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const providersApi = {
  list: (projectId: string) =>
    unwrap<ProviderListResponse>(apiClient.get(`/api/projects/${projectId}/providers`)),

  create: (projectId: string, payload: CreateProviderInput) =>
    unwrap<ProviderResponse>(apiClient.post(`/api/projects/${projectId}/providers`, payload)),

  update: (projectId: string, providerId: string, payload: UpdateProviderInput) =>
    unwrap<ProviderResponse>(
      apiClient.patch(`/api/projects/${projectId}/providers/${providerId}`, payload),
    ),

  deactivate: (projectId: string, providerId: string) =>
    unwrap<ProviderResponse>(
      apiClient.delete(`/api/projects/${projectId}/providers/${providerId}`),
    ),

  listForActivity: (projectId: string, activityId: string) =>
    unwrap<ActivityProvidersResponse>(
      apiClient.get(`/api/projects/${projectId}/activities/${activityId}/providers`),
    ),

  assignToActivity: (projectId: string, activityId: string, payload: AssignProviderInput) =>
    unwrap<ProviderResponse>(
      apiClient.post(`/api/projects/${projectId}/activities/${activityId}/providers`, payload),
    ),

  unassignFromActivity: (projectId: string, activityId: string, providerId: string) =>
    unwrap<{ providerId: string }>(
      apiClient.delete(
        `/api/projects/${projectId}/activities/${activityId}/providers/${providerId}`,
      ),
    ),
};
