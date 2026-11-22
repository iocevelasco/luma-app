import type {
  CalendarFeedCreated,
  CalendarFeedLanguage,
  CalendarFeedStatus,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';
import { unwrap } from '@/lib/api-envelope';

/** Capa 1 del feed de calendario personal (ADR-005 §3). */
export const calendarApi = {
  status: () => unwrap<CalendarFeedStatus>(apiClient.get('/api/calendar/feed')),
  /** La única respuesta que trae la URL: hay que mostrarla en ese momento. */
  create: (language: CalendarFeedLanguage) =>
    unwrap<CalendarFeedCreated>(apiClient.post('/api/calendar/feed', { language })),
  disable: () => unwrap<CalendarFeedStatus>(apiClient.delete('/api/calendar/feed')),
};
