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

/**
 * `details` es opcional y es para la máquina: con qué chocó, para que la UI
 * ofrezca una salida en vez de sólo decir que no (ver `CrewDuplicateDetails`).
 */
export const conflict = (message: string, details?: unknown) =>
  new AppError('CONFLICT', message, details);

export const termsRequired = () =>
  new AppError(
    'TERMS_REQUIRED',
    'Para seguir tenés que aceptar los Términos y la Política de Privacidad.',
  );

export const serviceUnavailable =(message: string) =>
  new AppError('SERVICE_UNAVAILABLE', message);

/**
 * El material ya salió de Pendiente. `code` propio y no un `CONFLICT` genérico
 * para que la pantalla refresque la fila sin comparar el texto.
 */
export const materialLocked = () =>
  new AppError(
    'MATERIAL_LOCKED',
    'Este material ya cambió de estado y no se puede editar ni eliminar.',
  );

/** La versión en lote: `details.ids` dice cuáles frenaron la acción entera. */
export const materialsLocked = (ids: string[], action: 'delete' | 'update') => {
  const what =
    ids.length === 1
      ? 'Uno de los materiales ya cambió de estado y no se puede'
      : `${ids.length} de los materiales ya cambiaron de estado y no se pueden`;
  return new AppError(
    'MATERIAL_LOCKED',
    action === 'delete'
      ? `${what} eliminar. No se borró ninguno.`
      : `${what} modificar. No se cambió ninguno.`,
    { ids },
  );
};
