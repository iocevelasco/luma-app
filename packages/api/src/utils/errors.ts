import { STATUS_BY_ERROR_CODE, type ApiErrorCode } from '@luma/shared';
import type { NextFunction, Request, Response } from 'express';

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

/**
 * Hay sesión, y la contraseña que se pidió para confirmar una acción sobre la
 * cuenta no es la de la cuenta.
 *
 * No es `unauthenticated()`: el cliente lee todo 401 con token como sesión
 * vencida y la cierra. Acá la sesión sigue valiendo — lo que falló es la
 * confirmación, y eso se corrige escribiéndola de nuevo en el formulario.
 */
export const wrongPassword = (message = 'La contraseña actual no es correcta.') =>
  new AppError('WRONG_PASSWORD', message);

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
    'Para seguir tienes que aceptar los Términos y la Política de Privacidad.',
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

/**
 * Express 4 no atrapa el `throw` de un handler async: sin esto el rechazo queda
 * sin manejar y, en Node moderno, tira abajo el proceso entero. Todo error va por
 * `next(error)` al `errorHandler`, que le da la forma `{ success, error, code }`.
 *
 * Un handler que **lanza** (`throw notFound(...)`) tiene que ir envuelto acá.
 */
export function wrapAsync(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

// ── Google (ADR-005 §1) ─────────────────────────────────────────────────────
// Ninguno es un 401: ver `STATUS_BY_ERROR_CODE`.

export const passwordNotSet = (
  message = 'Tu cuenta no tiene contraseña: entras con Google. Créala con «Olvidé mi contraseña».',
) => new AppError('PASSWORD_NOT_SET', message);

export const googleTokenInvalid = () =>
  new AppError('GOOGLE_TOKEN_INVALID', 'No pudimos confirmar tu cuenta de Google. Prueba de nuevo.');

export const googleEmailNotVerified = () =>
  new AppError(
    'GOOGLE_EMAIL_NOT_VERIFIED',
    'Google no tiene verificado el correo de esa cuenta. Entra con tu correo y contraseña.',
  );

export const googleSignupRequired = (details: { email: string; name: string }) =>
  new AppError(
    'GOOGLE_SIGNUP_REQUIRED',
    'No hay ninguna cuenta con ese correo. Para crearla, acepta los Términos.',
    details,
  );

/**
 * `details.reason` le dice a la UI qué salida ofrecer sin comparar el texto:
 * `password` = entrar con la contraseña y conectar; `invited` = activar la
 * cuenta desde el correo de invitación.
 */
export const googleLinkRequired = (reason: 'password' | 'invited' = 'password') =>
  new AppError(
    'GOOGLE_LINK_REQUIRED',
    reason === 'invited'
      ? 'Ya te invitaron con ese correo. Activa tu cuenta desde el enlace que te llegó por correo.'
      : 'Ya tienes una cuenta con ese correo. Entra con tu contraseña una vez y conectaremos tu Google.',
    { reason },
  );

export const googleAlreadyLinked = (
  message = 'Esa cuenta de Google ya está conectada a otra cuenta de Luma.',
) => new AppError('GOOGLE_ALREADY_LINKED', message);

export const googleUnlinkNeedsPassword = () =>
  new AppError(
    'GOOGLE_UNLINK_NEEDS_PASSWORD',
    'Tu cuenta no tiene contraseña: si desconectas Google no podrías entrar. Crea una contraseña primero.',
  );

export const googleNotAllowed = () =>
  new AppError('GOOGLE_NOT_ALLOWED', 'Esta cuenta no puede entrar con Google.');

/** Un índice único de Mongo rechazó la escritura. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 11000;
}
