import { useQuery } from '@tanstack/react-query';
import { publicConfigApi } from '@/api/public-config';
import { QueryKeys } from '@/lib/query-keys';

/**
 * Capa 2. Lo que las pantallas públicas necesitan del entorno: hoy, el client
 * id del botón de Google. Endpoint público: sin `enabled: isAuthenticated`. Las
 * claves de Maps y Drive están en `useIntegrationsConfig`, con sesión.
 */
export function usePublicConfig() {
  return useQuery({
    queryKey: [QueryKeys.publicConfig],
    queryFn: () => publicConfigApi.get(),
    staleTime: Infinity,
    retry: 1,
  });
}
