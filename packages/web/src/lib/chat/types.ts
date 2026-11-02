import type { ChatAttachment } from './attachments';

export type ChatRole = 'user' | 'assistant';
export type MessageStatus = 'streaming' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** No confiable: texto del usuario o Markdown generado por IA. */
  content: string;
  status: MessageStatus;
  /** Epoch en ms; 0 = desconocido (historial restaurado sin fecha válida). */
  createdAt: number;
  attachments: ChatAttachment[];
}

export interface ChatConversation {
  /** No confiable: se muestra sólo como texto y con largo tope. */
  title: string;
  messages: ChatMessage[];
}
