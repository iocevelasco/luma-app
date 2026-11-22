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
    // No cambia sin un redeploy, pero tampoco se congela: si el primer pedido
    // falla (un deploy en curso, la red), se reintenta y vuelve a pedirse al
    // enfocar la pestaña, en vez de dejar la integración apagada toda la sesión.
    retry: 3,
  });
}
