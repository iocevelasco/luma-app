import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MATERIAL_PHOTO_MAX_BYTES } from '@luma/shared';

/**
 * Subida de la foto de un material. En memoria: va directo al media-service y
 * nunca toca el disco. Campo único `photo`.
 */
export const materialPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MATERIAL_PHOTO_MAX_BYTES },
});

/** Formatos aceptados y la extensión con la que se guarda cada uno. */
export const MATERIAL_PHOTO_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function handleMaterialPhotoUploadError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'La foto es demasiado grande (máximo 8MB).' });
  }
  next(err);
}
