import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { LaborRecordInput } from '@luma/shared';
import { laborApi } from '@/api/labor';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2: mismo patrón que `use-activity-queries.ts`. */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

export function useLaborRecords(projectId: string | undefined, date: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.laborRecords, projectId, date],
    queryFn: () => laborApi.list(projectId!, date),
    enabled: isAuthenticated && !!projectId && !!date,
  });
}

export function useUpsertLaborRecord(projectId: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: LaborRecordInput) => laborApi.upsert(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.laborRecords, projectId] });
      toast.success(t('labor.list.saved'));
    },
    onError: (error) => toast.error(errorMessage(error, t('labor.errors.save'))),
  });
}
