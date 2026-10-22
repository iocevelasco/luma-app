import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';

/**
 * Subida de un comprobante (factura o remito). La comparten el alta de gasto
 * de Finanzas y la carga de facturas de Compras: es el mismo archivo, con el
 * mismo límite y los mismos formatos, y dos copias terminan divergiendo.
 *
 * En memoria: el archivo va directo al media-service, nunca toca el disco.
 */
export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

/** Formatos aceptados y la extensión con la que se guarda cada uno. */
export const RECEIPT_MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function handleReceiptUploadError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'El comprobante es demasiado grande (máximo 20MB)' });
  }
  next(err);
}
