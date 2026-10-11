import { STATUS_BY_ERROR_CODE, type ApiErrorCode } from '@luma/shared';

/**
 * El error que lanza la API cuando sabe qué pasó.
 *
 * Se lanza, no se devuelve: un `throw` corta el controller en el punto exacto
 * y el `errorHandler` lo formatea. Con `return res.status(...)` cada lugar
 * elige su propia forma, y eso es lo que había: 221 respuestas de error
 * escritas a mano, cada una con su criterio.
 *
 * ```ts
 * const obra = await Project.findById(id);
 * if (!obra) throw notFound('Obra no encontrada');
 * ```
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_ERROR_CODE[code];
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Los mensajes van en castellano y describen lo que pasó **desde el lado de
 * quien lo lee**, no desde el del servidor: "No encontramos esa obra" y no
 * "Project lookup returned null". El frontend los muestra tal cual.
 */
export const badRequest = (message: string, details?: unknown) =>
  new AppError('VALIDATION', message, details);

export const unauthenticated = (message = 'Necesitás iniciar sesión.') =>
  new AppError('UNAUTHENTICATED', message);

export const forbidden = (message = 'Tu rol no permite esta acción.') =>
  new AppError('FORBIDDEN', message);

export const notFound = (message = 'No encontramos lo que buscabas.') =>
  new AppError('NOT_FOUND', message);

export const conflict = (message: string) => new AppError('CONFLICT', message);

export const serviceUnavailable = (message: string) =>
  new AppError('SERVICE_UNAVAILABLE', message);
