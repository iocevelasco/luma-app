import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { STATUS_BY_ERROR_CODE, errorCodeForStatus, type ApiErrorBody } from '@luma/shared';
import { isProduction } from '../config/app.config.js';
import { isAppError } from '../utils/errors.js';

/**
 * El único lugar donde un error se convierte en respuesta.
 *
 * Todo sale con la misma forma —`{ success, error, code, details? }`— para
 * que el frontend pueda reaccionar por `code` en vez de comparar textos que
 * cambian cuando alguien edita un mensaje.
 *
 * Dos reglas que antes no se cumplían:
 *
 * 1. **Los mensajes van en castellano.** Decían "Validation error" y "Invalid
 *    ID format" en una app que está entera en castellano, y eso llegaba tal
 *    cual a la pantalla.
 * 2. **Un 500 nunca cuenta qué pasó adentro.** Antes devolvía
 *    `error.message`, que en un fallo de Mongoose es la consulta, el nombre
 *    de la colección y a veces el valor que chocó. Eso se loguea, no se
 *    manda.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const body = toErrorBody(error);

  // Sólo lo inesperado va al log: un 404 o un 403 son respuestas normales y
  // llenar el log con ellos esconde los errores de verdad.
  if (body.code === 'INTERNAL') {
    console.error('❌ [API]', error);
  }

  return res.status(STATUS_FOR[body.code]).json(body);
}

/** Una sola tabla código → status: la de `@luma/shared`. Una copia acá se desincroniza. */
const STATUS_FOR = STATUS_BY_ERROR_CODE;

function toErrorBody(error: unknown): ApiErrorBody {
  if (isAppError(error)) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  }

  if (error instanceof ZodError) {
    return {
      success: false,
      error: 'Revisá los datos: hay campos con errores.',
      code: 'VALIDATION',
      // El detalle por campo es lo que deja al formulario marcar cuál falló.
      details: error.issues,
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    // Un id con formato inválido es un 400 y no un 500: lo mandó mal quien
    // llamó, no se rompió nada del lado del servidor.
    return { success: false, error: 'El identificador no es válido.', code: 'VALIDATION' };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      success: false,
      error: 'Revisá los datos: hay campos con errores.',
      code: 'VALIDATION',
      details: Object.values(error.errors).map((issue) => issue.message),
    };
  }

  if (isDuplicateKey(error)) {
    return {
      success: false,
      error: 'Ya existe un registro con esos datos.',
      code: 'CONFLICT',
    };
  }

  // Errores con status explícito que vienen de servicios o de librerías.
  const status = (error as { status?: unknown })?.status;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    const code = errorCodeForStatus(status);
    return {
      success: false,
      error: code === 'INTERNAL' ? GENERIC_MESSAGE : asMessage(error),
      code,
    };
  }

  return {
    success: false,
    // En desarrollo el mensaje real ahorra ir al log; en producción no sale.
    error: isProduction ? GENERIC_MESSAGE : asMessage(error),
    code: 'INTERNAL',
  };
}

const GENERIC_MESSAGE = 'Algo falló de nuestro lado. Probá de nuevo en un momento.';

function asMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 11000;
}
