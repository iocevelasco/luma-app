/**
 * Consultor IA de una obra (chat de preguntas y respuestas sobre UNA obra
 * puntual, scoped server-side al `projectId` — nunca cross-obra). El historial
 * no se persiste: vive en el estado del componente y se pierde al recargar.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface SendChatMessageResponse {
  reply: string;
}
