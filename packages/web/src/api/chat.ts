import type { ApiResponse, ChatSession } from '@luma/shared';
import { apiClient } from '@/lib/api-client';

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export interface ChatPrompt {
  systemPrompt: string;
  updatedAt: string | null;
}

export const chatApi = {
  /** Abre la sesión de la conversación en NexusBot. El token vive sólo en memoria. */
  createSession: (conversationId: string) =>
    unwrap<ChatSession>(apiClient.post('/api/chat/session', { conversationId })),
  prompt: () => unwrap<ChatPrompt>(apiClient.get('/api/admin/chat-prompt')),
  savePrompt: (systemPrompt: string) =>
    unwrap<ChatPrompt>(apiClient.put('/api/admin/chat-prompt', { systemPrompt })),
};
