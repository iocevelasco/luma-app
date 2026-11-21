import type { PublicConfig } from '@luma/shared';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-envelope';

/** Capa 1. Pública: la leen también pantallas sin sesión, así que va con `skipAuth`. */
export const publicConfigApi = {
  get: () => unwrap<PublicConfig>(apiClient.get('/api/public/config', { skipAuth: true })),
};
