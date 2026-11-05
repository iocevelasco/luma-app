import { create } from 'zustand';
import { validateAttachments, type AttachmentRejection, type ChatAttachment } from './attachments';
import { assessContent } from './content';
import { restoreHistory } from './history';
import { CHAT_LIMITS } from './limits';
import { MOCK_HISTORY, streamMockReply } from './mock-assistant';
import { ChatTransportError, type ChatCapabilities, type ChatFailure, type ChatTransport } from './transport';
import type { ChatMessage } from './types';
import { revokeLocalPreview } from './urls';

/**
 * Estado del chat **en memoria**. Sobrevive a cerrar el panel (el store vive
 * en el módulo) y muere al recargar. No se persiste en `localStorage` ni en
 * IndexedDB: una conversación y sus adjuntos pueden ser sensibles. Guardarlos
 * es una decisión de producto que se toma junto con el backend.
 *
 * Nada acá se loguea: ni mensajes, ni nombres, ni URLs, ni los errores del
 * stream. Un fallo se reduce a un código que la UI traduce.
 *
 * Cada store tiene su propio transporte: el prototipo usa el asistente
 * simulado y el panel real usa NexusBot, sin compartir conversación.
 */
export type ChatErrorCode = 'empty' | 'busy' | ChatFailure;

export interface ChatState {
  title: string;
  messages: ChatMessage[];
  draftAttachments: ChatAttachment[];
  rejected: { name: string; reason: AttachmentRejection }[];
  error: ChatErrorCode | null;
  isStreaming: boolean;
  /** Hay adjuntos en validación (se leen sus bytes): no se puede enviar todavía. */
  isAttaching: boolean;
  /** Mensajes descartados al restaurar el historial. */
  discarded: number;
  /** Qué acepta el backend de este chat. La UI esconde lo que no se puede usar. */
  capabilities: ChatCapabilities;

  addFiles: (files: readonly File[]) => Promise<void>;
  removeDraftAttachment: (id: string) => void;
  dismissNotices: () => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  restore: (raw: unknown) => void;
  reset: () => void;
}

const initial = {
  title: '',
  messages: [] as ChatMessage[],
  draftAttachments: [] as ChatAttachment[],
  rejected: [] as ChatState['rejected'],
  error: null as ChatErrorCode | null,
  isStreaming: false,
  isAttaching: false,
  discarded: 0,
};

function revokeAll(messages: ChatMessage[], draft: ChatAttachment[]) {
  for (const a of draft) revokeLocalPreview(a.previewUrl);
  for (const m of messages) for (const a of m.attachments) revokeLocalPreview(a.previewUrl);
}

export function createChatStore(config: { transport: ChatTransport; capabilities: ChatCapabilities }) {
  const { transport, capabilities } = config;
  let controller: AbortController | null = null;
  let seq = 0;
  const nextId = () => `m-${Date.now().toString(36)}-${seq++}`;

  return create<ChatState>((set, get) => ({
    ...initial,
    capabilities,

    async addFiles(files) {
      // Sin soporte en el backend no hay adjuntos: ni por el botón, ni pegando ni arrastrando.
      if (!capabilities.attachments) return;
      set({ isAttaching: true });
      try {
        const { accepted, rejected } = await validateAttachments(files, get().draftAttachments.length);
        set((s) => ({ draftAttachments: [...s.draftAttachments, ...accepted], rejected }));
      } finally {
        set({ isAttaching: false });
      }
    },

    removeDraftAttachment(id) {
      const found = get().draftAttachments.find((a) => a.id === id);
      revokeLocalPreview(found?.previewUrl);
      set((s) => ({ draftAttachments: s.draftAttachments.filter((a) => a.id !== id) }));
    },

    dismissNotices() {
      set({ rejected: [], error: null });
    },

    async send(raw) {
      const text = raw.trim();
      const { draftAttachments, isStreaming, isAttaching } = get();
      // Mientras se envía o se valida un adjunto no se envía: ni por el botón ni por Enter.
      if (isStreaming || isAttaching) return set({ error: 'busy' });
      if (!text && draftAttachments.length === 0) return set({ error: 'empty' });
      if (text.length > CHAT_LIMITS.maxUserChars) return set({ error: 'too-long' });
      if (get().messages.length >= CHAT_LIMITS.maxHistoryMessages) return set({ error: 'too-long' });

      const userMsg: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: text,
        status: 'done',
        createdAt: Date.now(),
        attachments: draftAttachments,
      };
      const replyId = nextId();
      set((s) => ({
        messages: [
          ...s.messages,
          userMsg,
          { id: replyId, role: 'assistant', content: '', status: 'streaming', createdAt: Date.now(), attachments: [] },
        ],
        draftAttachments: [],
        rejected: [],
        error: null,
        isStreaming: true,
      }));

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === replyId ? fn(m) : m)) }));

      controller = new AbortController();
      try {
        let received = '';
        for await (const chunk of transport.stream({ message: text, signal: controller.signal })) {
          received += chunk;
          // Tope en el store: un stream que no termina no hace crecer la memoria.
          if (received.length > CHAT_LIMITS.maxAssistantChars) {
            received = assessContent(received, CHAT_LIMITS.maxAssistantChars).text;
            patch((m) => ({ ...m, content: received }));
            break;
          }
          patch((m) => ({ ...m, content: received }));
        }
        patch((m) => ({ ...m, status: 'done' }));
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError';
        // Sin console.*: el error real puede traer contenido de la conversación.
        patch((m) => ({ ...m, status: aborted ? 'done' : 'error' }));
        if (!aborted) set({ error: e instanceof ChatTransportError ? e.failure : 'stream' });
      } finally {
        controller = null;
        set({ isStreaming: false });
      }
    },

    stop() {
      controller?.abort();
    },

    restore(raw) {
      controller?.abort();
      const { messages, draftAttachments } = get();
      revokeAll(messages, draftAttachments);
      const { conversation, discarded } = restoreHistory(raw);
      set({ ...initial, title: conversation.title, messages: conversation.messages, discarded });
    },

    reset() {
      controller?.abort();
      const { messages, draftAttachments } = get();
      revokeAll(messages, draftAttachments);
      // La conversación nueva también lo es en el servidor, que guarda memoria por sesión.
      transport.reset();
      set({ ...initial });
    },
  }));
}

export type ChatStoreHook = ReturnType<typeof createChatStore>;

/** El asistente simulado del prototipo: sin red, con adjuntos de prueba. */
export const mockTransport: ChatTransport = {
  stream: ({ message, signal }) => streamMockReply(message, signal),
  reset: () => {},
};

export const useChatStore = createChatStore({
  transport: mockTransport,
  capabilities: { attachments: true },
});

export const restoreMockHistory = () => useChatStore.getState().restore(MOCK_HISTORY);
