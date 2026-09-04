/**
 * Error con status HTTP explícito.
 *
 * Los servicios lanzan esto y `errorHandler` lo traduce: así ninguna capa de
 * negocio necesita el objeto `res` para decir "esto es un 403".
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export const badRequest = (m: string, c?: string) => new HttpError(400, m, c);
export const unauthorized = (m = 'No autenticado', c?: string) => new HttpError(401, m, c);
export const forbidden = (m = 'No tenés permiso para esto', c?: string) => new HttpError(403, m, c);
export const notFound = (m = 'No encontrado', c?: string) => new HttpError(404, m, c);
export const conflict = (m: string, c?: string) => new HttpError(409, m, c);
