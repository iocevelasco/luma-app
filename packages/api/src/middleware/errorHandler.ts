import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export function errorHandler(
  error: Error | ZodError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors,
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: Object.values(error.errors).map((e) => e.message),
    });
  }

  // Mongoose duplicate key error
  if ((error as any).code === 11000) {
    const field = Object.keys((error as any).keyPattern ?? {})[0] ?? 'field';
    return res.status(409).json({ success: false, error: `Duplicate value for ${field}` });
  }

  // Errores de servicio con status HTTP explícito (ej. el guard de billing
  // lanza 402 con code MEMBER_CAP_REACHED). Mismo contrato que handleSvcError
  // en routes/teams.ts, pero centralizado.
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({
      success: false,
      error: error.message,
      ...((error as { code?: string }).code ? { code: (error as { code?: string }).code } : {}),
    });
  }

  console.error('Error:', error);

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
}

