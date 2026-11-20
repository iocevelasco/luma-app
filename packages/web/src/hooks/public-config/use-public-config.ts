import { useQuery } from '@tanstack/react-query';
import { publicConfigApi } from '@/api/public-config';
import { QueryKeys } from '@/lib/query-keys';

/**
 * Capa 2. Qué integraciones están prendidas en este entorno (Google Drive…).
 * Endpoint público: sin `enabled: isAuthenticated`. No cambia sin un redeploy.
 */
export function usePublicConfig() {
  return useQuery({
    queryKey: [QueryKeys.publicConfig],
    queryFn: () => publicConfigApi.get(),
    staleTime: Infinity,
    retry: 1,
  });
}
