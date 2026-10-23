import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PlatformUsersQuery } from '@luma/shared';
import { platformUsersApi } from '@/api/platform';
import { QueryKeys } from '@/lib/query-keys';
import { isAdmin } from '@/lib/roles';
import { useAuth } from '@/providers/auth-provider';

/**
 * Capa 2 de las cuentas que ve el admin de plataforma. `enabled` pide además
 * el rol: a un usuario común el endpoint le contesta 403.
 */
function useIsPlatformAdmin() {
  const { isAuthenticated, user } = useAuth();
  return isAuthenticated && isAdmin(user?.role);
}

export function usePlatformUsersOverview() {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.platformUsersOverview],
    queryFn: () => platformUsersApi.overview(),
    enabled,
  });
}

export function usePlatformUsers(query: PlatformUsersQuery) {
  const enabled = useIsPlatformAdmin();

  return useQuery({
    queryKey: [QueryKeys.platformUsers, query],
    queryFn: () => platformUsersApi.list(query),
    enabled,
    // Al pasar de página o escribir en el buscador la lista no se vacía: se
    // queda la anterior hasta que llega la nueva.
    placeholderData: keepPreviousData,
  });
}
