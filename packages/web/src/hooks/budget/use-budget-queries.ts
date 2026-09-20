import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CreateBudgetInput } from '@luma/shared';
import { budgetApi } from '@/api/budget';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-labor-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useBudget(projectId: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.budget, projectId],
    queryFn: () => budgetApi.get(projectId!),
    enabled: isAuthenticated && !!projectId,
  });
}

export function useCreateBudget(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: CreateBudgetInput) => budgetApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.budget, projectId] });
      toast.success(t('budget.list.created'));
    },
    onError: (error) => toast.error(errorMessage(error, t('budget.errors.create'))),
  });
}
