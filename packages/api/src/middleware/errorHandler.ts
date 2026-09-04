import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { HttpError } from '../utils/errors.js';
import { isProduction } from '../config/app.config.js';

/**
 * Traductor único de errores a respuestas.
 *
 * Todas las rutas devuelven la misma forma —`{ success, error, code? }`— así
 * el cliente tiene un solo camino de manejo de errores en lugar de uno por
 * endpoint.
 */
export function errorHandler(
  error: Error | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: error.errors[0]?.message ?? 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: error.errors,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, error: 'ID inválido', code: 'INVALID_ID' });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      error: Object.values(error.errors)[0]?.message ?? 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map((e) => e.message),
    });
  }

  if ((error as { code?: number }).code === 11000) {
    const field = Object.keys((error as any).keyPattern ?? {})[0] ?? 'campo';
    return res.status(409).json({
      success: false,
      error: `Ya existe un registro con ese ${field}`,
      code: 'DUPLICATE',
    });
  }

  console.error('❌ [ERROR]', error);
  res.status(500).json({
    success: false,
    error: isProduction ? 'Error interno del servidor' : error.message,
    code: 'INTERNAL_ERROR',
  });
}
