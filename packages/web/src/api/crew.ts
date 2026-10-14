import type {
  ApiResponse,
  CreateCrewMemberInput,
  CrewMemberListResponse,
  CrewMemberResponse,
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
  /** Lo de la libreta de la Empresa que esta obra todavía no tiene. */
  listDirectory: (projectId: string) =>
    unwrap<CrewMemberListResponse>(apiClient.get(`/api/projects/${projectId}/crew/directory`)),

  /** `reactivate` reactiva a alguien dado de baja en el mismo paso. Pide `crew.manage`. */
  addFromDirectory: (projectId: string, crewMemberId: string, options?: { reactivate?: boolean }) =>
    unwrap<CrewMemberResponse>(
      apiClient.post(`/api/projects/${projectId}/crew/directory/${crewMemberId}`, {
        ...(options?.reactivate ? { reactivate: true } : {}),
      }),
    ),

  removeFromProject: (projectId: string, crewMemberId: string) =>
    unwrap<{ crewMemberId: string }>(
      apiClient.delete(`/api/projects/${projectId}/crew/directory/${crewMemberId}`),
    ),

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
};
