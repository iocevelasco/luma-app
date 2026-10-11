import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import mongoose from 'mongoose';

const config = vi.hoisted(() => ({ isProduction: false }));
vi.mock('../../config/app.config.js', () => config);

const { errorHandler } = await import('../../middleware/errorHandler.js');
const { normalizeErrors } = await import('../../middleware/normalizeErrors.js');
const { badRequest, conflict, forbidden, notFound } = await import('../../utils/errors.js');

function mockRes(): Response & { body?: unknown; code?: number } {
  const res = {} as Response & { body?: unknown; code?: number };
  res.status = vi.fn((status: number) => {
    res.code = status;
    return res;
  }) as never;
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  }) as never;
  return res;
}

const req = {} as Request;
const next = (() => {}) as NextFunction;

beforeEach(() => vi.clearAllMocks());

describe('errorHandler', () => {
  it('un AppError sale con su código y su mensaje', () => {
    const res = mockRes();

    errorHandler(notFound('No encontramos esa obra.'), req, res, next);

    expect(res.code).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: 'No encontramos esa obra.',
      code: 'NOT_FOUND',
    });
  });

  it.each([
    [forbidden(), 403, 'FORBIDDEN'],
    [conflict('Ya tiene acceso.'), 409, 'CONFLICT'],
    [badRequest('Falta el archivo.'), 400, 'VALIDATION'],
  ])('mapea cada helper a su status', (error, status, code) => {
    const res = mockRes();

    errorHandler(error, req, res, next);

    expect(res.code).toBe(status);
    expect((res.body as { code: string }).code).toBe(code);
  });

  it('un ZodError conserva el detalle por campo', () => {
    const parsed = z.object({ email: z.string().email() }).safeParse({ email: 'no' });
    const res = mockRes();

    errorHandler(parsed.success ? new Error('x') : (parsed.error as ZodError), req, res, next);

    const body = res.body as { code: string; details: unknown[] };
    expect(res.code).toBe(400);
    expect(body.code).toBe('VALIDATION');
    // Sin `details`, el formulario no puede marcar qué campo falló.
    expect(body.details).toHaveLength(1);
  });

  it('un id con formato inválido es 400, no 500', () => {
    const res = mockRes();

    errorHandler(new mongoose.Error.CastError('ObjectId', 'nope', '_id'), req, res, next);

    expect(res.code).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION');
  });

  it('una clave duplicada es un conflicto', () => {
    const res = mockRes();

    errorHandler({ code: 11000, keyPattern: { email: 1 } }, req, res, next);

    expect(res.code).toBe(409);
    expect((res.body as { code: string }).code).toBe('CONFLICT');
  });

  it('lo inesperado es INTERNAL y se loguea', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();

    errorHandler(new Error('se cayó mongo'), req, res, next);

    expect(res.code).toBe(500);
    expect((res.body as { code: string }).code).toBe('INTERNAL');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('no loguea los errores esperados', () => {
    // Un 404 es una respuesta normal: llenarlo el log con ellos esconde los
    // errores de verdad.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(notFound(), req, mockRes(), next);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('normalizeErrors', () => {
  function withMiddleware(status: number, body: unknown) {
    const res = mockRes();
    normalizeErrors(req, res, next);
    res.statusCode = status;
    res.json(body);
    return res.body;
  }

  it('le agrega el código a una respuesta armada a mano', () => {
    // Es lo que hace que el contrato valga YA para los 221 res.status() que
    // todavía no pasan por el errorHandler.
    expect(withMiddleware(404, { success: false, error: 'Obra no encontrada' })).toEqual({
      success: false,
      error: 'Obra no encontrada',
      code: 'NOT_FOUND',
    });
  });

  it('respeta el código que ya venía', () => {
    const body = withMiddleware(403, {
      success: false,
      error: 'No podés',
      code: 'FORBIDDEN_CAPABILITY',
    }) as { code: string };

    expect(body.code).toBe('FORBIDDEN_CAPABILITY');
  });

  it('un 400 con details es validación', () => {
    const body = withMiddleware(400, {
      success: false,
      error: 'Datos inválidos',
      details: [{ path: ['email'] }],
    }) as { code: string };

    expect(body.code).toBe('VALIDATION');
  });

  it('no toca las respuestas exitosas', () => {
    expect(withMiddleware(200, { success: true, data: { id: '1' } })).toEqual({
      success: true,
      data: { id: '1' },
    });
  });
});

describe('normalizeErrors: un 5xx no cuenta qué pasó adentro', () => {
  function respond(status: number, body: unknown) {
    const res = mockRes();
    normalizeErrors(req, res, next);
    res.statusCode = status;
    res.json(body);
    return res.body as { error: string; code: string };
  }

  it('en producción reemplaza el mensaje interno', () => {
    // `errMsg(error)` en un fallo de Mongoose trae la consulta, la colección
    // y a veces el valor que chocó. Eso no sale de acá.
    config.isProduction = true;
    try {
      const body = respond(500, {
        success: false,
        error: 'E11000 duplicate key error collection: luma.users index: email_1',
      });

      expect(body.error).not.toContain('luma.users');
      expect(body.code).toBe('INTERNAL');
    } finally {
      config.isProduction = false;
    }
  });

  it('en desarrollo lo deja, que es donde sirve', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const body = respond(500, { success: false, error: 'se cayó mongo' });

    expect(body.error).toBe('se cayó mongo');
    spy.mockRestore();
  });

  it('no toca los 4xx: ahí el mensaje es para la persona', () => {
    const body = respond(409, { success: false, error: 'Esa persona ya tiene acceso a la obra' });

    expect(body.error).toBe('Esa persona ya tiene acceso a la obra');
    expect(body.code).toBe('CONFLICT');
  });
});
