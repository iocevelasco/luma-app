import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { organizationsApi } from '@/api/organizations';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-auth-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useMyOrganization() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.organization],
    queryFn: () => organizationsApi.me(),
    enabled: isAuthenticated,
  });
}

export function useRenameOrganization() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (name: string) => organizationsApi.rename(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.organization] });
    },
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}
