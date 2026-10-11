import type { ApiResponse, MarkReadResponse, NotificationListResponse } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/projects.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const notificationsApi = {
  /** La bandeja cruza todas las obras: no cuelga de ningún `projectId`. */
  list: () => unwrap<NotificationListResponse>(apiClient.get('/api/notifications')),

  markRead: (notificationId: string) =>
    unwrap<MarkReadResponse>(apiClient.post(`/api/notifications/${notificationId}/read`, {})),

  markAllRead: () => unwrap<MarkReadResponse>(apiClient.post('/api/notifications/read', {})),
};
