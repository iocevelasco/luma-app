import type {
  ApiResponse,
  CreateProjectInput,
  CreateProjectResponse,
  InvitableProjectRole,
  InviteProjectMemberInput,
  InviteProjectMemberResponse,
  RemoveProjectMemberResponse,
  UpdateProjectMemberResponse,
  ProjectDetailResponse,
  ProjectListResponse,
  UpdateProjectInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/auth.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const projectsApi = {
  list: () => unwrap<ProjectListResponse>(apiClient.get('/api/projects')),

  get: (projectId: string) =>
    unwrap<ProjectDetailResponse>(apiClient.get(`/api/projects/${projectId}`)),

  create: (payload: CreateProjectInput) =>
    unwrap<CreateProjectResponse>(apiClient.post('/api/projects', payload)),

  update: (projectId: string, payload: UpdateProjectInput) =>
    unwrap<CreateProjectResponse>(apiClient.patch(`/api/projects/${projectId}`, payload)),

  inviteMember: (projectId: string, payload: InviteProjectMemberInput) =>
    unwrap<InviteProjectMemberResponse>(
      apiClient.post(`/api/projects/${projectId}/members`, payload),
    ),

  updateMemberRole: (projectId: string, membershipId: string, role: InvitableProjectRole) =>
    unwrap<UpdateProjectMemberResponse>(
      apiClient.patch(`/api/projects/${projectId}/members/${membershipId}`, { role }),
    ),

  removeMember: (projectId: string, membershipId: string) =>
    unwrap<RemoveProjectMemberResponse>(
      apiClient.delete(`/api/projects/${projectId}/members/${membershipId}`),
    ),
};
