/**
 * El contrato entre el chat y quien produce las respuestas. El store sólo
 * conoce esto: con el asistente simulado o con NexusBot el resto no cambia.
 */
export type ChatFailure =
  | 'stream'
  | 'network'
  | 'rate-limited'
  | 'session'
  | 'unavailable'
  | 'too-long';

/**
 * Un fallo del transporte, reducido a un código. **El texto del servidor no se
 * conserva**: puede traer orígenes, proyectos o errores del modelo, y a la
 * persona se le muestra siempre un mensaje propio traducido.
 */
export class ChatTransportError extends Error {
  readonly failure: ChatFailure;
  constructor(failure: ChatFailure) {
    super(failure);
    this.name = 'ChatTransportError';
    this.failure = failure;
    Object.setPrototypeOf(this, ChatTransportError.prototype);
  }
}

export interface ChatTransport {
  /** Un trozo de texto por iteración. Cancelar con `signal` corta el stream. */
  stream(args: { message: string; signal: AbortSignal }): AsyncIterable<string>;
  /** Empieza una conversación nueva: la siguiente respuesta no recuerda la anterior. */
  reset(): void;
}

/** Lo que hay que saber del chat para mostrarlo: qué puede hacer este transporte. */
export interface ChatCapabilities {
  /** El backend acepta imágenes. NexusBot hoy sólo recibe texto. */
  attachments: boolean;
}
