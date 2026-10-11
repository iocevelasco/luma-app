import type { ApiResponse, ChatMessage, SendChatMessageResponse } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/budget.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const advisorApi = {
  sendMessage: (projectId: string, message: string, history: ChatMessage[]) =>
    unwrap<SendChatMessageResponse>(
      apiClient.post(`/api/projects/${projectId}/advisor`, { message, history }),
    ),
};
