import type { PurchaseRow } from './materials';

/** Una foto reducida y codificada como JPEG. Medidas en píxeles. */
export interface ResizedPhoto {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/** Lo que baja el PDF: una foto de 20 mm no necesita más, y pesa poco. */
export const PDF_PHOTO = { maxSide: 480, quality: 0.8 } as const;
/**
 * Lo que se guarda al subirla: alcanza para mirarla en el celular y mostrársela
 * a un vendedor, y pesa unos cientos de KB en vez de varios MB. Es lo que se
 * comparte tal cual, sin trabajo pesado dentro del gesto de la persona.
 */
export const UPLOAD_PHOTO = { maxSide: 1600, quality: 0.85 } as const;
/** Cuántas fotos se bajan a la vez: las 50 de una obra grande no se piden juntas. */
export const PHOTO_PREFETCH_CONCURRENCY = 3;
/** WhatsApp admite hasta 30 imágenes por envío; más que eso se pierde sin avisar. */
export const MAX_SHARED_PHOTOS = 30;

function decode(blob: Blob): Promise<{ image: HTMLImageElement; release: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto'));
    };
    image.src = url;
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce la foto a un JPEG de hasta `maxSide` píxeles de lado. Una foto de
 * celular pesa varios MB: tal cual, el PDF de una lista de veinte materiales
 * no se puede mandar por chat. Respeta la orientación EXIF, que el navegador
 * aplica al decodificar.
 */
export async function resizePhoto(
  source: Blob,
  { maxSide, quality }: { maxSide: number; quality: number },
): Promise<ResizedPhoto> {
  const { image, release } = await decode(source);
  try {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la foto');
    // Un PNG con transparencia saldría negro en un JPEG.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('No se pudo codificar la foto'))),
        'image/jpeg',
        quality,
      ),
    );
    return { blob, dataUrl: await readAsDataUrl(blob), width, height };
  } finally {
    release();
  }
}

/**
 * La foto lista para subir: reducida a `UPLOAD_PHOTO`. Si no se puede leer (un
 * formato que el navegador no decodifica) o no sale más liviana, se sube la
 * original: la API la valida igual.
 */
export async function prepareUploadPhoto(file: File): Promise<File> {
  try {
    const { blob } = await resizePhoto(file, UPLOAD_PHOTO);
    if (blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^./\\]+$/, '') || 'foto';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * Corre `task` sobre cada elemento con a lo sumo `limit` en vuelo, y deja de
 * tomar nuevos cuando `shouldStop()` da `true` (la pantalla ya se cambió). Una
 * tarea que falla no frena al resto: de eso se ocupa quien la define.
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<unknown>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next];
      next += 1;
      try {
        await task(item);
      } catch {
        // Ver arriba.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Las fotos de las filas que tienen. Una que no se puede bajar se salta: la
 * lista sale igual, esa fila sin foto. Es mejor que un PDF que no sale porque
 * falló una imagen.
 */
export async function loadRowPhotos(
  rows: PurchaseRow[],
  load: (materialId: string, version: string) => Promise<Blob>,
): Promise<Map<string, Blob>> {
  const withPhoto = rows.filter((row) => row.photoVersion);
  const settled = await Promise.allSettled(
    withPhoto.map((row) => load(row.id, row.photoVersion as string)),
  );

  const photos = new Map<string, Blob>();
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') photos.set(withPhoto[index].id, result.value);
  });
  return photos;
}

/**
 * Nombre de archivo para una foto compartida: el del material, para que quien
 * la recibe sepa qué es. Sin caracteres que un sistema de archivos rechace, y
 * sin repetirse dentro de un mismo envío.
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': '.png',
  'image/webp': '.webp',
};

export function photoFileName(name: string, taken: Set<string>, mimeType = 'image/jpeg'): string {
  const printable = [...name.normalize('NFC')].filter((char) => char.charCodeAt(0) >= 32).join('');
  const base =
    printable
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || 'material';

  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${base} (${n})`;
  taken.add(candidate.toLowerCase());
  return `${candidate}${EXTENSION_BY_TYPE[mimeType] ?? '.jpg'}`;
}
