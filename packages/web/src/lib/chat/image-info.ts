import type { AllowedImageType } from './limits';

/**
 * Lee el formato **real** y las dimensiones de una imagen mirando sus bytes.
 * La extensión, el `type` declarado y el atributo `accept` los controla quien
 * sube el archivo, así que no prueban nada; los primeros bytes sí. Devuelve
 * `null` si no es JPEG, PNG ni WebP (un SVG o un HTML caen acá).
 *
 * No decodifica la imagen: sólo recorre cabeceras, así que no gasta memoria de
 * píxeles con un archivo que declara 60000×60000.
 */
export interface ImageInfo {
  type: AllowedImageType;
  width: number;
  height: number;
}

const ascii = (b: Uint8Array, at: number, len: number) =>
  String.fromCharCode(...b.subarray(at, at + len));

export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
}

function readPng(b: Uint8Array): ImageInfo | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v) || ascii(b, 12, 4) !== 'IHDR') return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { type: 'image/png', width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = b[at + 1];
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // SOF0..SOF15, salvo DHT (C4), JPG (C8) y DAC (CC): traen el tamaño.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { type: 'image/jpeg', height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    at += 2 + view.getUint16(at + 2);
  }
  // Un JPEG sin SOF no es una imagen que se pueda mostrar.
  return null;
}

function readWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(b, 12, 4);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (chunk === 'VP8 ') {
    return {
      type: 'image/webp',
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = view.getUint32(21, true);
    return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const w = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const h = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { type: 'image/webp', width: w, height: h };
  }
  return null;
}
