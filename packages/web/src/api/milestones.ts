import type {
  ApiResponse,
  CreateMilestoneInput,
  DeleteMilestoneResponse,
  MilestoneListResponse,
  MilestoneResponse,
  UpdateMilestoneInput,
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

export const milestonesApi = {
  list: (projectId: string) =>
    unwrap<MilestoneListResponse>(apiClient.get(`/api/projects/${projectId}/milestones`)),

  create: (projectId: string, payload: CreateMilestoneInput) =>
    unwrap<MilestoneResponse>(apiClient.post(`/api/projects/${projectId}/milestones`, payload)),

  update: (projectId: string, milestoneId: string, payload: UpdateMilestoneInput) =>
    unwrap<MilestoneResponse>(
      apiClient.patch(`/api/projects/${projectId}/milestones/${milestoneId}`, payload),
    ),

  remove: (projectId: string, milestoneId: string) =>
    unwrap<DeleteMilestoneResponse>(
      apiClient.delete(`/api/projects/${projectId}/milestones/${milestoneId}`),
    ),
};
