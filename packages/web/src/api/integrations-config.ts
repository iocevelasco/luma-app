import type { ApiResponse, IntegrationsConfig } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1. Las claves de Maps y Drive: con sesión, sólo se usan adentro de la app. */
export const integrationsConfigApi = {
  get: async (): Promise<IntegrationsConfig> => {
    const response = await apiClient.get<ApiResponse<IntegrationsConfig>>('/api/config/integrations');
    if (!response.success || response.data === undefined) {
      throw new Error(response.error ?? 'Respuesta inesperada de la API');
    }
    return response.data;
  },
};
