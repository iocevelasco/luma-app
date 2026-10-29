import { useQuery } from '@tanstack/react-query';
import { platformActivityApi } from '@/api/platform';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/**
 * Capa 2 de la actividad por rol. `enabled` pide además el rol: a un usuario
 * común el endpoint le contesta 403.
 */
export function usePlatformActivity() {
  const { isAuthenticated, user } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.platformActivity],
    queryFn: () => platformActivityApi.report(),
    enabled: isAuthenticated && isAdmin(user?.role),
  });
}
