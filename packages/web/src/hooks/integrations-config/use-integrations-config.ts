import { useQuery } from '@tanstack/react-query';
import { integrationsConfigApi } from '@/api/integrations-config';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/**
 * Capa 2. Qué integraciones con clave están prendidas (Maps, Drive), con sus
 * claves de navegador. Endpoint con sesión. No cambia sin un redeploy.
 */
export function useIntegrationsConfig() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [QueryKeys.integrationsConfig],
    queryFn: () => integrationsConfigApi.get(),
    // Obligatorio en toda query protegida: un 401 en una pantalla pública patea a /login.
    enabled: isAuthenticated,
    // No cambia sin un redeploy, pero tampoco se congela: si el primer pedido
    // falla (un deploy en curso, la red), se reintenta y vuelve a pedirse al
    // enfocar la pestaña, en vez de dejar la integración apagada toda la sesión.
    retry: 3,
  });
}
