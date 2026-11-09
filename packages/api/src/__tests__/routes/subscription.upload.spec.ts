import type { Request, Response } from 'express';
import multer from 'multer';
import { describe, expect, it, vi } from 'vitest';
import { missingBolivaresEnv } from '../../config/app.config.js';
import { handleUploadError } from '../../routes/subscription.js';
import { AppError } from '../../utils/errors.js';

function errorPassedToNext(err: unknown) {
  const next = vi.fn();
  handleUploadError(err, {} as Request, {} as Response, next);
  return next.mock.calls[0]?.[0];
}

describe('handleUploadError', () => {
  it('un archivo demasiado grande es un 413 con su code', () => {
    const error = errorPassedToNext(new multer.MulterError('LIMIT_FILE_SIZE'));
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', status: 413 });
  });

  it('otro error de multer no dice que el archivo es grande', () => {
    const error = errorPassedToNext(new multer.MulterError('LIMIT_UNEXPECTED_FILE'));
    expect(error).toMatchObject({ code: 'VALIDATION', message: 'Sube un solo comprobante.' });
  });

  it('deja pasar cualquier otro error', () => {
    const original = new Error('otra cosa');
    expect(errorPassedToNext(original)).toBe(original);
  });
});

describe('missingBolivaresEnv', () => {
  it('nombra sólo lo que falta de cada método', () => {
    expect(
      missingBolivaresEnv({ PAGO_MOVIL_BANK: 'Banesco', PAGO_MOVIL_PHONE: '0414', TRANSFER_BANK: '' }),
    ).toEqual({
      pagoMovil: ['PAGO_MOVIL_ID'],
      transferencia: ['TRANSFER_BANK', 'TRANSFER_ACCOUNT', 'TRANSFER_HOLDER', 'TRANSFER_ID'],
    });
  });

  it('con todo cargado no falta nada', () => {
    expect(
      missingBolivaresEnv({
        PAGO_MOVIL_BANK: 'a',
        PAGO_MOVIL_PHONE: 'b',
        PAGO_MOVIL_ID: 'c',
        TRANSFER_BANK: 'd',
        TRANSFER_ACCOUNT: 'e',
        TRANSFER_HOLDER: 'f',
        TRANSFER_ID: 'g',
      }),
    ).toEqual({ pagoMovil: [], transferencia: [] });
  });
});
