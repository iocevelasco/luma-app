import { MATERIAL_PHOTO_MIME_TYPES } from '@luma/shared';

/** Para el atributo `accept` del selector de archivos. */
export const MATERIAL_PHOTO_ACCEPT = MATERIAL_PHOTO_MIME_TYPES.join(',');

/**
 * Lo máximo que se deja elegir. Más que el tope de la API (8 MB) a propósito:
 * la foto se achica antes de subir, así que lo que cuenta es lo que llega al
 * servidor, y una foto de celular de 12 MB sale de ahí en unos cientos de KB.
 * Lo que ya no se puede ni leer en el navegador es lo que este tope frena.
 */
export const MATERIAL_PHOTO_PICK_MAX_BYTES = 30 * 1024 * 1024;

export type MaterialPhotoCheck = 'ok' | 'type' | 'size';

/** Lo que no tiene sentido ni intentar subir, avisado antes de gastar datos. */
export function checkMaterialPhoto(file: Pick<File, 'type' | 'size'>): MaterialPhotoCheck {
  if (!(MATERIAL_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MATERIAL_PHOTO_PICK_MAX_BYTES) return 'size';
  return 'ok';
}
