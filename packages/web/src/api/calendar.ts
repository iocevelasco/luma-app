import type {
  ApiResponse,
  CalendarFeedCreated,
  CalendarFeedLanguage,
  CalendarFeedStatus,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1 del feed de calendario personal (ADR-005 §3). */
async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const calendarApi = {
  status: () => unwrap<CalendarFeedStatus>(apiClient.get('/api/calendar/feed')),
  /** La única respuesta que trae la URL: hay que mostrarla en ese momento. */
  create: (language: CalendarFeedLanguage) =>
    unwrap<CalendarFeedCreated>(apiClient.post('/api/calendar/feed', { language })),
  disable: () => unwrap<CalendarFeedStatus>(apiClient.delete('/api/calendar/feed')),
};
