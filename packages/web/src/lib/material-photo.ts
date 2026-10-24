import { MATERIAL_PHOTO_MAX_BYTES, MATERIAL_PHOTO_MIME_TYPES } from '@luma/shared';

/** Para el atributo `accept` del selector de archivos. */
export const MATERIAL_PHOTO_ACCEPT = MATERIAL_PHOTO_MIME_TYPES.join(',');

export type MaterialPhotoCheck = 'ok' | 'type' | 'size';

/**
 * Lo que la API rechazaría, avisado antes de subir: una foto de 12 MB por datos
 * móviles tarda en subir y recién ahí dice "demasiado grande".
 */
export function checkMaterialPhoto(file: Pick<File, 'type' | 'size'>): MaterialPhotoCheck {
  if (!(MATERIAL_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MATERIAL_PHOTO_MAX_BYTES) return 'size';
  return 'ok';
}
