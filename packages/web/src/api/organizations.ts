import type {
  ApiResponse,
  InviteMemberInput,
  InviteMemberResponse,
  OrganizationMembersResponse,
  OrganizationResponse,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/**
 * Capa 1: mismo patrón que `src/api/auth.ts` — nunca lo importa un componente,
 * sólo los hooks de `src/hooks/organizations`.
 */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const organizationsApi = {
  me: () => unwrap<OrganizationResponse>(apiClient.get('/api/organizations/me')),

  rename: (name: string) =>
    unwrap<OrganizationResponse>(apiClient.patch('/api/organizations/me', { name })),

  listMembers: () =>
    unwrap<OrganizationMembersResponse>(apiClient.get('/api/organizations/me/members')),

  inviteMember: (payload: InviteMemberInput) =>
    unwrap<InviteMemberResponse>(apiClient.post('/api/organizations/me/members', payload)),
};
