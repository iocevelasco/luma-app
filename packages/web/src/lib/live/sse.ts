/**
 * Lector de Server-Sent Events sobre un `ReadableStream` de `fetch`.
 *
 * `EventSource` no manda `Authorization` y no deja ver el status de un error,
 * así que el canal de tiempo real se lee con `fetch` (ver `api-client.openStream`).
 * Misma idea que el parser de `lib/chat/nexus-stream.ts`, pero entrega marcos
 * crudos `{ event, data }` y no sabe nada del contenido.
 *
 * Lo que llega es contenido no confiable: se acota lo que se acumula y quien
 * consume valida la forma de cada marco.
 */

export interface SseFrame {
  event: string;
  data: string;
}

/** Un marco sin terminar que pase de esto no es un aviso de obra: es un fallo. */
const MAX_PENDING_CHARS = 64 * 1024;

export class SseProtocolError extends Error {
  constructor(message = 'Stream SSE inválido') {
    super(message);
    this.name = 'SseProtocolError';
    Object.setPrototypeOf(this, SseProtocolError.prototype);
  }
}

/** Parsea un marco ya separado (sin el `\n\n` final). `null` si es sólo comentarios (latidos `:`). */
export function parseSseFrame(raw: string): SseFrame | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of raw.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }

  return data.length === 0 ? null : { event, data: data.join('\n') };
}

/**
 * Entrega los marcos a medida que llegan. Termina cuando el servidor cierra.
 * Al dejar de iterar (o cancelar) suelta el lector, que cierra la conexión.
 */
export async function* readSseFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      if (buffer.length > MAX_PENDING_CHARS) throw new SseProtocolError('Marco SSE demasiado largo');

      let separator: number;
      while ((separator = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);

        const frame = parseSseFrame(raw);
        if (frame) yield frame;
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}
