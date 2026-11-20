import type { ApiResponse, PublicConfig } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1. Pública: la leen también pantallas sin sesión, así que va con `skipAuth`. */
export const publicConfigApi = {
  get: async (): Promise<PublicConfig> => {
    const response = await apiClient.get<ApiResponse<PublicConfig>>('/api/public/config', {
      skipAuth: true,
    });
    if (!response.success || response.data === undefined) {
      throw new Error(response.error ?? 'Respuesta inesperada de la API');
    }
    return response.data;
  },
};
