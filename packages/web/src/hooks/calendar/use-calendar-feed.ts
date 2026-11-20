import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CalendarFeedLanguage } from '@luma/shared';
import { calendarApi } from '@/api/calendar';
import { errorMessage } from '@/lib/error-message';
import { QueryKeys } from '@/lib/query-keys';
import { toast } from '@/lib/toast';
import { useAuth } from '@/providers/auth-provider';

/** Capa 2. Si el feed está prendido. La URL no viene acá: sólo al generarla. */
export function useCalendarFeed() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [QueryKeys.calendarFeed],
    queryFn: () => calendarApi.status(),
    enabled: isAuthenticated,
  });
}

/** Generar o regenerar. La URL que devuelve hay que guardarla en la pantalla: no vuelve a salir. */
export function useCreateCalendarFeed() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (language: CalendarFeedLanguage) => calendarApi.create(language),
    onSuccess: (data) =>
      queryClient.setQueryData([QueryKeys.calendarFeed], { enabled: true, createdAt: data.createdAt }),
    // Sin formulario detrás: la falla va por toast.
    onError: (error) => toast.error(errorMessage(error, t) ?? t('errors.internal')),
  });
}

export function useDisableCalendarFeed() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => calendarApi.disable(),
    onSuccess: (data) => {
      queryClient.setQueryData([QueryKeys.calendarFeed], data);
      toast.success(t('auth.calendarFeed.disabled'));
    },
    onError: (error) => toast.error(errorMessage(error, t) ?? t('errors.internal')),
  });
}
