import type {
  ApiResponse,
  CreateProjectInput,
  CreateProjectResponse,
  InviteClientInput,
  InviteClientResponse,
  ProjectDetailResponse,
  ProjectListResponse,
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

  inviteClient: (projectId: string, payload: InviteClientInput) =>
    unwrap<InviteClientResponse>(
      apiClient.post(`/api/projects/${projectId}/clients`, payload),
    ),
};
