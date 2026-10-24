import type {
  ApiResponse,
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
