import { readImageInfo } from './image-info';
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  CHAT_LIMITS,
  type AllowedImageType,
} from './limits';
import { createLocalPreview } from './urls';

/**
 * Validación de adjuntos en el navegador. Mejora la experiencia (se rechaza al
 * instante y con motivo) pero **no es un control de seguridad**: quien llame a
 * la API sin pasar por la UI se la salta. El servidor tiene que repetir todo
 * esto sobre el contenido real (ver `docs/CHAT-SEGURIDAD.md`).
 */
export type AttachmentRejection =
  | 'too-many'
  | 'type'
  | 'empty'
  | 'too-large'
  | 'dimensions'
  | 'unreadable';

export interface ChatAttachment {
  id: string;
  /** Sólo para mostrar, siempre como texto. */
  name: string;
  type: AllowedImageType;
  size: number;
  width: number;
  height: number;
  /** `blob:` creado por la app; se valida contra el registro al mostrarlo. */
  previewUrl: string;
}

export interface AttachmentResult {
  accepted: ChatAttachment[];
  rejected: { name: string; reason: AttachmentRejection }[];
}

/**
 * Nombre apto para mostrar: sin caracteres de control ni de dirección (que
 * reordenan visualmente el texto, como en `foto‮gnp.exe`) y con largo tope.
 * Es higiene de presentación; el escape lo hace React.
 */
export function displayFileName(name: string): string {
  const clean = Array.from(name)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      const control = c < 0x20 || (c >= 0x7f && c <= 0x9f);
      const bidi = (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
      return !control && !bidi;
    })
    .join('')
    .trim();
  const shown = clean || 'imagen';
  return shown.length > CHAT_LIMITS.maxFileNameChars
    ? `${shown.slice(0, CHAT_LIMITS.maxFileNameChars - 1)}…`
    : shown;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

let nextId = 0;

export async function validateAttachments(
  files: readonly File[],
  alreadyAttached: number,
): Promise<AttachmentResult> {
  const result: AttachmentResult = { accepted: [], rejected: [] };

  for (const file of files) {
    const name = displayFileName(file.name);

    if (alreadyAttached + result.accepted.length >= CHAT_LIMITS.maxAttachments) {
      result.rejected.push({ name, reason: 'too-many' });
      continue;
    }
    // Filtro barato antes de leer bytes: lo declarado tiene que estar en la
    // lista… y después se comprueba contra el contenido.
    const declaredOk = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
    const extOk = (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name));
    if (!declaredOk || !extOk) {
      result.rejected.push({ name, reason: 'type' });
      continue;
    }
    if (file.size === 0) {
      result.rejected.push({ name, reason: 'empty' });
      continue;
    }
    if (file.size > CHAT_LIMITS.maxFileBytes) {
      result.rejected.push({ name, reason: 'too-large' });
      continue;
    }

    let info;
    try {
      info = readImageInfo(new Uint8Array(await file.arrayBuffer()));
    } catch {
      result.rejected.push({ name, reason: 'unreadable' });
      continue;
    }
    // El contenido manda: un SVG o un HTML renombrado a .png no tiene firma.
    if (!info || info.type !== file.type) {
      result.rejected.push({ name, reason: 'type' });
      continue;
    }
    if (
      info.width < 1 ||
      info.height < 1 ||
      info.width > CHAT_LIMITS.maxImageSide ||
      info.height > CHAT_LIMITS.maxImageSide ||
      info.width * info.height > CHAT_LIMITS.maxImagePixels
    ) {
      result.rejected.push({ name, reason: 'dimensions' });
      continue;
    }

    result.accepted.push({
      id: `att-${Date.now().toString(36)}-${nextId++}`,
      name,
      type: info.type,
      size: file.size,
      width: info.width,
      height: info.height,
      previewUrl: createLocalPreview(file),
    });
  }
  return result;
}
