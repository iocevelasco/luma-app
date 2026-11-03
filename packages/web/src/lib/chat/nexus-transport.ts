import { isApiError } from '@/lib/api-client';
import { NexusHttpError, streamNexusChat } from './nexus-stream';
import { ChatTransportError, type ChatFailure, type ChatTransport } from './transport';

/**
 * Transporte real: habla con NexusBot. La sesión la abre la API de Luma (la
 * clave de NexusBot no sale al navegador) y el token vive **sólo en memoria**.
 *
 * - El token se renueva antes de vencer y, si NexusBot responde `token_expired`
 *   antes de empezar a contestar, se pide uno nuevo y se reintenta una vez.
 * - Cada conversación nueva tiene su `conversationId`, y por tanto su propia
 *   sesión y su propia memoria en NexusBot.
 */
export interface OpenedSession {
  sessionToken: string;
  expiresAt: string;
}

/** Margen para no mandar un token que vence mientras viaja. */
const RENEW_MARGIN_MS = 30_000;

/** Un identificador que no es secreto: sólo separa conversaciones. */
export function newConversationId(): string {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function failureFromOpenError(error: unknown): ChatFailure {
  if (isApiError(error)) {
    if (error.status === 429) return 'rate-limited';
    if (error.status === 401) return 'session';
    return 'unavailable';
  }
  // Un `fetch` que ni llegó a la API.
  return 'network';
}

export function createNexusTransport(options: {
  apiUrl: string;
  openSession: (conversationId: string) => Promise<OpenedSession>;
  newId?: () => string;
  now?: () => number;
}): ChatTransport {
  const { apiUrl, openSession } = options;
  const newId = options.newId ?? newConversationId;
  const now = options.now ?? Date.now;

  let conversationId = newId();
  let session: { token: string; expiresAtMs: number } | null = null;

  async function getToken(force = false): Promise<string> {
    if (!force && session && session.expiresAtMs - now() > RENEW_MARGIN_MS) return session.token;
    session = null;
    let opened: OpenedSession;
    try {
      opened = await openSession(conversationId);
    } catch (error) {
      throw new ChatTransportError(failureFromOpenError(error));
    }
    session = { token: opened.sessionToken, expiresAtMs: Date.parse(opened.expiresAt) || 0 };
    return session.token;
  }

  return {
    async *stream({ message, signal }) {
      let token = await getToken();
      for (let attempt = 0; ; attempt++) {
        let yielded = false;
        try {
          for await (const chunk of streamNexusChat({ apiUrl, sessionToken: token, message, signal })) {
            yielded = true;
            yield chunk;
          }
          return;
        } catch (error) {
          const expired = error instanceof NexusHttpError && error.code === 'token_expired';
          // Sólo se reintenta si todavía no se mostró nada: así no se duplica texto.
          if (expired && attempt === 0 && !yielded) {
            token = await getToken(true);
            continue;
          }
          throw error;
        }
      }
    },

    reset() {
      conversationId = newId();
      session = null;
    },
  };
}
