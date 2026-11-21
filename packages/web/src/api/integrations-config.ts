import type { IntegrationsConfig } from '@luma/shared';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-envelope';

/** Capa 1. Las claves de Maps y Drive: con sesión, sólo se usan adentro de la app. */
export const integrationsConfigApi = {
  get: () => unwrap<IntegrationsConfig>(apiClient.get('/api/config/integrations')),
};
