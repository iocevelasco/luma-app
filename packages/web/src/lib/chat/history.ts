import type { ChatAttachment } from './attachments';
import { clampTitle } from './content';
import { CHAT_LIMITS } from './limits';
import { displayFileName } from './attachments';
import type { ChatConversation, ChatMessage } from './types';

/**
 * Restaurar un historial es recibir contenido no confiable: lo trajo un
 * servidor, un archivo o un storage que alguien pudo tocar. Se re-valida la
 * forma y los límites; el contenido sigue pasando por el mismo `ChatMarkdown`
 * que el streaming, así que no hay un camino "de confianza" para lo guardado.
 *
 * Los adjuntos restaurados no recuperan su vista previa: una `blob:` de otra
 * sesión no existe, y una que alguien escribió a mano no está en el registro
 * de previews de la app, así que el visor la bloquearía igual.
 */
export interface RestoreResult {
  conversation: ChatConversation;
  /** Cuántos mensajes se descartaron por tener forma inválida. */
  discarded: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function restoreHistory(raw: unknown): RestoreResult {
  const empty: RestoreResult = { conversation: { title: '', messages: [] }, discarded: 0 };
  if (!isRecord(raw) || !Array.isArray(raw.messages)) return empty;

  const messages: ChatMessage[] = [];
  let discarded = 0;

  raw.messages.slice(0, CHAT_LIMITS.maxHistoryMessages).forEach((item, index) => {
    if (!isRecord(item) || (item.role !== 'user' && item.role !== 'assistant')) {
      discarded += 1;
      return;
    }
    if (typeof item.content !== 'string') {
      discarded += 1;
      return;
    }
    const max = item.role === 'user' ? CHAT_LIMITS.maxUserChars : CHAT_LIMITS.maxAssistantChars;
    const attachments: ChatAttachment[] = Array.isArray(item.attachments)
      ? item.attachments.slice(0, CHAT_LIMITS.maxAttachments).flatMap((a, i) =>
          isRecord(a) && typeof a.name === 'string'
            ? [
                {
                  id: `restored-${index}-${i}`,
                  name: displayFileName(a.name),
                  type: 'image/png' as const,
                  size: 0,
                  width: 0,
                  height: 0,
                  // Lo que venga en el historial se trata como URL externa.
                  previewUrl: typeof a.previewUrl === 'string' ? a.previewUrl : '',
                },
              ]
            : [],
        )
      : [];
    messages.push({
      id: `restored-${index}`,
      role: item.role,
      content: item.content.slice(0, max),
      status: 'done',
      attachments,
    });
  });

  discarded += Math.max(0, raw.messages.length - CHAT_LIMITS.maxHistoryMessages);
  return { conversation: { title: clampTitle(raw.title), messages }, discarded };
}
