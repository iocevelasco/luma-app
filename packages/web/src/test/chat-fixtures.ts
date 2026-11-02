/** Imágenes mínimas pero con cabeceras reales, para probar la validación por contenido. */
function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') for (const ch of p) out.push(ch.charCodeAt(0));
    else out.push(...p);
  }
  return new Uint8Array(out);
}
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >>> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

export function pngBytes(width = 10, height = 10): Uint8Array {
  return bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), 'IHDR', be32(width), be32(height), [8, 6, 0, 0, 0], be32(0));
}

export function jpegBytes(width = 10, height = 10): Uint8Array {
  // SOI + APP0 corto + SOF0.
  return bytes([0xff, 0xd8, 0xff, 0xe0], be16(4), [0, 0], [0xff, 0xc0], be16(11), [8], be16(height), be16(width), [1, 1, 0x11, 0], [0xff, 0xd9]);
}

export function webpBytes(width = 10, height = 10): Uint8Array {
  return bytes('RIFF', [30, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0], [0, 0, 0, 0], le24(width - 1), le24(height - 1));
}

export function makeFile(data: Uint8Array | string, name: string, type: string): File {
  const part = typeof data === 'string' ? data : (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
  return new File([part], name, { type });
}

/** `URL.createObjectURL` no existe en todos los entornos de test. */
export function stubObjectUrls() {
  let n = 0;
  const created: string[] = [];
  const revoked: string[] = [];
  URL.createObjectURL = () => {
    const url = `blob:https://luma.test/${n++}`;
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    revoked.push(url);
  };
  return { created, revoked };
}
