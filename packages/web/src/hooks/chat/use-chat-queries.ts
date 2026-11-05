import { useMutation } from '@tanstack/react-query';
import { chatApi } from '@/api/chat';

/**
 * Capa 2 del chat: abrir una sesión es una acción (cada conversación nueva
 * abre la suya), no una lectura que se cachee, por eso es una mutación.
 */
export function useOpenChatSession() {
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.createSession(conversationId),
  });
}
