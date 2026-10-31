import type {
  ApiResponse,
  Campaign,
  CampaignAudience,
  CampaignInput,
  PlatformActivityReport,
  PlatformUsersOverview,
  PlatformUsersPage,
  PlatformUsersQuery,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1 de lo que mira el admin de plataforma: nunca la importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const platformUsersApi = {
  overview: () => unwrap<PlatformUsersOverview>(apiClient.get('/api/admin/users/overview')),

  list: ({ filter, q, page, pageSize }: PlatformUsersQuery) => {
    const params = new URLSearchParams({ filter, page: String(page), pageSize: String(pageSize) });
    if (q) params.set('q', q);
    return unwrap<PlatformUsersPage>(apiClient.get(`/api/admin/users?${params.toString()}`));
  },
};

export const platformActivityApi = {
  report: () => unwrap<PlatformActivityReport>(apiClient.get('/api/admin/activity')),
};

export const platformCampaignsApi = {
  list: () => unwrap<Campaign[]>(apiClient.get('/api/admin/campaigns')),

  audience: () => unwrap<CampaignAudience>(apiClient.get('/api/admin/campaigns/audience')),

  /** Multipart: la imagen viaja con el texto en el mismo request. */
  create: (payload: CampaignInput, image: File | null) => {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('body', payload.body);
    if (image) formData.append('image', image);
    return unwrap<Campaign>(apiClient.post('/api/admin/campaigns', formData));
  },

  test: (id: string) =>
    unwrap<{ sent: boolean; to: string }>(apiClient.post(`/api/admin/campaigns/${id}/test`)),

  send: (id: string) => unwrap<Campaign>(apiClient.post(`/api/admin/campaigns/${id}/send`)),

  remove: (id: string) => unwrap<{ id: string }>(apiClient.delete(`/api/admin/campaigns/${id}`)),
};
