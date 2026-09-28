import type {
  ApiResponse,
  CreateCrewGoalInput,
  CreateCrewMemberInput,
  CrewGoalListResponse,
  CrewGoalResponse,
  CrewMemberListResponse,
  CrewMemberResponse,
  UpdateCrewGoalInput,
  UpdateCrewMemberInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/providers.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const crewApi = {
  list: (projectId: string) =>
    unwrap<CrewMemberListResponse>(apiClient.get(`/api/projects/${projectId}/crew`)),

  create: (projectId: string, payload: CreateCrewMemberInput) =>
    unwrap<CrewMemberResponse>(apiClient.post(`/api/projects/${projectId}/crew`, payload)),

  update: (projectId: string, crewMemberId: string, payload: UpdateCrewMemberInput) =>
    unwrap<CrewMemberResponse>(
      apiClient.patch(`/api/projects/${projectId}/crew/${crewMemberId}`, payload),
    ),

  deactivate: (projectId: string, crewMemberId: string) =>
    unwrap<CrewMemberResponse>(apiClient.delete(`/api/projects/${projectId}/crew/${crewMemberId}`)),

  listGoals: (projectId: string, weekStart?: string) => {
    const query = weekStart ? `?weekStart=${weekStart}` : '';
    return unwrap<CrewGoalListResponse>(
      apiClient.get(`/api/projects/${projectId}/crew/goals${query}`),
    );
  },

  createGoal: (projectId: string, payload: CreateCrewGoalInput) =>
    unwrap<CrewGoalResponse>(apiClient.post(`/api/projects/${projectId}/crew/goals`, payload)),

  updateGoal: (projectId: string, goalId: string, payload: UpdateCrewGoalInput) =>
    unwrap<CrewGoalResponse>(
      apiClient.patch(`/api/projects/${projectId}/crew/goals/${goalId}`, payload),
    ),

  deleteGoal: (projectId: string, goalId: string) =>
    unwrap<{ goalId: string }>(
      apiClient.delete(`/api/projects/${projectId}/crew/goals/${goalId}`),
    ),
};
