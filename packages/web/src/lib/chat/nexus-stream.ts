import { CHAT_LIMITS } from './limits';
import { ChatTransportError, type ChatFailure } from './transport';

/**
 * Cliente SSE de NexusBot: `POST {apiUrl}/api/v1/chat/stream`.
 *
 * `EventSource` no admite POST ni cabeceras, así que se parsea sobre `fetch`.
 * Eventos: `data: {"text":"…"}`, `data: [DONE]`, `event: error` y `: ping`
 * (latido, se ignora).
 *
 * Lo que llega es contenido no confiable: el texto se entrega tal cual al
 * renderer (que lo escapa) y los errores se reducen a un código; el mensaje del
 * servidor nunca llega a la UI.
 */

/** Un evento SSE sin terminar que pase de esto no es un chat: es un fallo. */
const MAX_PENDING_BYTES = 256 * 1024;

/** Códigos de NexusBot → lo que entiende la UI. */
const FAILURE_BY_CODE: Record<string, ChatFailure> = {
  rate_limited: 'rate-limited',
  message_too_long: 'too-long',
  token_expired: 'session',
  invalid_token: 'session',
  missing_token: 'session',
  session_not_found: 'session',
  tenant_not_found: 'unavailable',
  tenant_inactive: 'unavailable',
  origin_not_allowed: 'unavailable',
  llm_auth_error: 'unavailable',
  llm_error: 'stream',
  validation_error: 'stream',
  network_error: 'network',
};

export function failureFromCode(code: unknown, status?: number): ChatFailure {
  if (typeof code === 'string' && code in FAILURE_BY_CODE) return FAILURE_BY_CODE[code];
  if (status === 429) return 'rate-limited';
  if (status === 401) return 'session';
  if (status && status >= 500) return 'unavailable';
  return 'stream';
}

/** El `code` que NexusBot puso en el cuerpo de error, si lo hay. Sirve para decidir si se renueva el token. */
export class NexusHttpError extends ChatTransportError {
  readonly code?: string;
  readonly status?: number;
  constructor(failure: ChatFailure, code?: string, status?: number) {
    super(failure);
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, NexusHttpError.prototype);
  }
}

export async function* streamNexusChat(args: {
  apiUrl: string;
  sessionToken: string;
  message: string;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  let res: Response;
  try {
    res = await fetch(`${args.apiUrl}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${args.sessionToken}`,
      },
      body: JSON.stringify({ message: args.message }),
      signal: args.signal,
      // Sin cookies ni credenciales del navegador: la autorización es el token.
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ChatTransportError('network');
  }

  if (!res.ok) {
    let code: string | undefined;
    try {
      const body: unknown = await res.json();
      const raw = (body as { error?: { code?: unknown } } | null)?.error?.code;
      if (typeof raw === 'string') code = raw;
    } catch {
      // Cuerpo que no es JSON: alcanza con el status.
    }
    throw new NexusHttpError(failureFromCode(code, res.status), code, res.status);
  }
  if (!res.body) throw new ChatTransportError('network');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let received = 0;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      if (buffer.length > MAX_PENDING_BYTES) throw new ChatTransportError('stream');

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith(':')) continue;
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        }
        if (dataLines.length === 0) continue;
        const data = dataLines.join('\n');

        if (data === '[DONE]') return;

        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new ChatTransportError('stream');
        }

        if (eventName === 'error') {
          const code = (payload as { error?: { code?: unknown } } | null)?.error?.code;
          throw new ChatTransportError(failureFromCode(code));
        }

        const text = (payload as { text?: unknown } | null)?.text;
        if (typeof text === 'string' && text) {
          received += text.length;
          // Un stream que no termina no hace crecer la memoria sin tope.
          if (received > CHAT_LIMITS.maxAssistantChars * 2) throw new ChatTransportError('stream');
          yield text;
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof ChatTransportError) throw error;
    throw new ChatTransportError('network');
  } finally {
    // Cierra la conexión si quien consume deja de leer (Detener).
    void reader.cancel().catch(() => {});
  }

  // La conexión se cerró sin `[DONE]`: la respuesta quedó cortada.
  throw new ChatTransportError('network');
}
