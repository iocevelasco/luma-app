import type {
  ApiResponse,
  CreateCrewMemberInput,
  CreateProviderInput,
  InviteMemberInput,
  InviteMemberResponse,
  OrganizationCrewListResponse,
  OrganizationCrewResponse,
  OrganizationMembersResponse,
  OrganizationProviderListResponse,
  OrganizationProviderResponse,
  OrganizationResponse,
  UpdateCrewMemberInput,
  UpdateOrganizationInput,
  UpdateOrganizationMemberInput,
  UpdateProviderInput,
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

  update: (payload: UpdateOrganizationInput) =>
    unwrap<OrganizationResponse>(apiClient.patch('/api/organizations/me', payload)),

  listMembers: () =>
    unwrap<OrganizationMembersResponse>(apiClient.get('/api/organizations/me/members')),

  inviteMember: (payload: InviteMemberInput) =>
    unwrap<InviteMemberResponse>(apiClient.post('/api/organizations/me/members', payload)),

  updateMember: (memberId: string, payload: UpdateOrganizationMemberInput) =>
    unwrap<InviteMemberResponse>(
      apiClient.patch(`/api/organizations/me/members/${memberId}`, payload),
    ),

  removeMember: (memberId: string) =>
    unwrap<{ memberId: string }>(apiClient.delete(`/api/organizations/me/members/${memberId}`)),

  resendInvitation: (memberId: string) =>
    unwrap<InviteMemberResponse>(
      apiClient.post(`/api/organizations/me/members/${memberId}/resend`, {}),
    ),

  // --- Libreta de la Empresa: proveedores y empleados ---

  listProviders: () =>
    unwrap<OrganizationProviderListResponse>(apiClient.get('/api/organizations/me/providers')),

  createProvider: (payload: CreateProviderInput) =>
    unwrap<OrganizationProviderResponse>(
      apiClient.post('/api/organizations/me/providers', payload),
    ),

  updateProvider: (providerId: string, payload: UpdateProviderInput) =>
    unwrap<OrganizationProviderResponse>(
      apiClient.patch(`/api/organizations/me/providers/${providerId}`, payload),
    ),

  deactivateProvider: (providerId: string) =>
    unwrap<OrganizationProviderResponse>(
      apiClient.delete(`/api/organizations/me/providers/${providerId}`),
    ),

  setProviderProjects: (providerId: string, projectIds: string[]) =>
    unwrap<OrganizationProviderResponse>(
      apiClient.put(`/api/organizations/me/providers/${providerId}/projects`, { projectIds }),
    ),

  listCrew: () =>
    unwrap<OrganizationCrewListResponse>(apiClient.get('/api/organizations/me/crew')),

  createCrewMember: (payload: CreateCrewMemberInput) =>
    unwrap<OrganizationCrewResponse>(apiClient.post('/api/organizations/me/crew', payload)),

  updateCrewMember: (crewMemberId: string, payload: UpdateCrewMemberInput) =>
    unwrap<OrganizationCrewResponse>(
      apiClient.patch(`/api/organizations/me/crew/${crewMemberId}`, payload),
    ),

  deactivateCrewMember: (crewMemberId: string) =>
    unwrap<OrganizationCrewResponse>(
      apiClient.delete(`/api/organizations/me/crew/${crewMemberId}`),
    ),

  setCrewMemberProjects: (crewMemberId: string, projectIds: string[]) =>
    unwrap<OrganizationCrewResponse>(
      apiClient.put(`/api/organizations/me/crew/${crewMemberId}/projects`, { projectIds }),
    ),
};
