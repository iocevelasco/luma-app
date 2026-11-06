import {
  LIVE_BYE_REASONS,
  LIVE_PROTOCOL_VERSION,
  isLiveResource,
  liveStreamPath,
  type LiveByeReason,
  type LiveResource,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';
import { readSseFrames, type SseFrame } from '@/lib/live/sse';

/**
 * Capa 1 del tiempo real: abre el stream de la obra y entrega mensajes ya
 * validados. Nunca lo importa un componente: lo consume `useProjectLive`.
 *
 * No usa `unwrap` porque no hay sobre `{ success, data }`: es un stream de
 * eventos. Lo que sí hereda de `apiClient` es la sesión (renueva el token ante
 * un 401) y el `ApiError` con status y `code`.
 */

export type LiveMessage =
  | { type: 'ready'; heartbeatMs: number }
  | { type: 'invalidate'; projectId: string; resources: LiveResource[] }
  | { type: 'ping' }
  | { type: 'bye'; reason: LiveByeReason };

/** El servidor contestó 204: ningún recurso en vivo es de este rol. No se reintenta. */
export class LiveIdleError extends Error {
  constructor() {
    super('Nada que escuchar en vivo para este rol');
    this.name = 'LiveIdleError';
    Object.setPrototypeOf(this, LiveIdleError.prototype);
  }
}

/** Este navegador no puede leer un stream con `fetch`: sólo queda el polling. */
export class LiveUnsupportedError extends Error {
  constructor() {
    super('El navegador no soporta streams con fetch');
    this.name = 'LiveUnsupportedError';
    Object.setPrototypeOf(this, LiveUnsupportedError.prototype);
  }
}

/**
 * Un marco a mensaje, o `null` si no se entiende. Lo desconocido se ignora y
 * no corta la conexión: un servidor más nuevo puede mandar eventos que este
 * cliente todavía no conoce (`v` distinta, un evento nuevo).
 */
export function toLiveMessage(frame: SseFrame): LiveMessage | null {
  let payload: unknown;
  try {
    payload = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  const body = payload as Record<string, unknown>;
  if (body.v !== LIVE_PROTOCOL_VERSION) return null;

  switch (frame.event) {
    case 'ready':
      return typeof body.heartbeatMs === 'number' && body.heartbeatMs > 0
        ? { type: 'ready', heartbeatMs: body.heartbeatMs }
        : null;
    case 'invalidate': {
      if (typeof body.projectId !== 'string' || !Array.isArray(body.resources)) return null;
      const resources = body.resources.filter(isLiveResource);
      return resources.length > 0 ? { type: 'invalidate', projectId: body.projectId, resources } : null;
    }
    case 'ping':
      return { type: 'ping' };
    case 'bye':
      return (LIVE_BYE_REASONS as readonly unknown[]).includes(body.reason)
        ? { type: 'bye', reason: body.reason as LiveByeReason }
        : null;
    default:
      return null;
  }
}

export const liveApi = {
  /**
   * Abre el stream de la obra y entrega sus mensajes. Termina cuando el
   * servidor cierra; cancelar el `signal` lo corta desde acá.
   */
  async *open(projectId: string, signal: AbortSignal): AsyncGenerator<LiveMessage> {
    const response = await apiClient.openStream(liveStreamPath(projectId), signal);

    if (response.status === 204) throw new LiveIdleError();
    // Detectado por capacidad y no por user-agent: en un Safari viejo `body`
    // existe pero no es legible, y la conexión no sirve.
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new LiveUnsupportedError();
    }

    for await (const frame of readSseFrames(response.body)) {
      const message = toLiveMessage(frame);
      if (message) yield message;
    }
  },
};
