import { beforeEach, describe, expect, it } from 'vitest';
import { jpegBytes, makeFile, pngBytes, stubObjectUrls, webpBytes } from '@/test/chat-fixtures';
import { displayFileName, validateAttachments } from './attachments';
import { readImageInfo } from './image-info';
import { CHAT_LIMITS } from './limits';

let urls: ReturnType<typeof stubObjectUrls>;
beforeEach(() => {
  urls = stubObjectUrls();
});

describe('readImageInfo', () => {
  it('lee formato y dimensiones de PNG, JPEG y WebP', () => {
    expect(readImageInfo(pngBytes(30, 20))).toEqual({ type: 'image/png', width: 30, height: 20 });
    expect(readImageInfo(jpegBytes(300, 200))).toEqual({ type: 'image/jpeg', width: 300, height: 200 });
    expect(readImageInfo(webpBytes(64, 48))).toEqual({ type: 'image/webp', width: 64, height: 48 });
  });

  it('devuelve null para SVG, HTML y bytes al azar', () => {
    const enc = new TextEncoder();
    expect(readImageInfo(enc.encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'))).toBeNull();
    expect(readImageInfo(enc.encode('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(readImageInfo(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('validateAttachments', () => {
  it('acepta JPEG, PNG y WebP válidos y crea una vista previa por cada uno', async () => {
    const { accepted, rejected } = await validateAttachments(
      [
        makeFile(pngBytes(), 'a.png', 'image/png'),
        makeFile(jpegBytes(), 'b.jpg', 'image/jpeg'),
        makeFile(webpBytes(), 'c.webp', 'image/webp'),
      ],
      0,
    );
    expect(rejected).toEqual([]);
    expect(accepted.map((a) => a.type)).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(urls.created).toHaveLength(3);
  });

  it('rechaza SVG y HTML aunque declaren ser una imagen permitida', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>';
    const { accepted, rejected } = await validateAttachments(
      [
        makeFile(svg, 'logo.svg', 'image/svg+xml'),
        makeFile(svg, 'logo.png', 'image/png'), // contenido SVG con nombre y MIME de PNG
        makeFile('<script>alert(1)</script>', 'pagina.html', 'text/html'),
        makeFile('<script>alert(1)</script>', 'pagina.png', 'image/png'),
      ],
      0,
    );
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual(['type', 'type', 'type', 'type']);
    expect(urls.created).toHaveLength(0);
  });

  it('el MIME declarado tampoco alcanza: un PNG que dice ser JPEG se rechaza', async () => {
    const { accepted, rejected } = await validateAttachments([makeFile(pngBytes(), 'a.jpg', 'image/jpeg')], 0);
    expect(accepted).toEqual([]);
    expect(rejected[0].reason).toBe('type');
  });

  it('rechaza archivos vacíos y demasiado grandes', async () => {
    const big = new Uint8Array(CHAT_LIMITS.maxFileBytes + 1);
    big.set(pngBytes());
    const { accepted, rejected } = await validateAttachments(
      [makeFile(new Uint8Array(0), 'v.png', 'image/png'), makeFile(big, 'grande.png', 'image/png')],
      0,
    );
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual(['empty', 'too-large']);
  });

  it('rechaza dimensiones fuera de límite', async () => {
    const { accepted, rejected } = await validateAttachments(
      [
        makeFile(pngBytes(CHAT_LIMITS.maxImageSide + 1, 10), 'ancha.png', 'image/png'),
        makeFile(pngBytes(4096, 4096), 'pixeles.png', 'image/png'),
        makeFile(pngBytes(0, 10), 'cero.png', 'image/png'),
      ],
      0,
    );
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual(['dimensions', 'dimensions', 'dimensions']);
  });

  it('respeta el máximo de adjuntos contando los que ya había', async () => {
    const files = Array.from({ length: 3 }, (_, i) => makeFile(pngBytes(), `${i}.png`, 'image/png'));
    const { accepted, rejected } = await validateAttachments(files, CHAT_LIMITS.maxAttachments - 1);
    expect(accepted).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual(['too-many', 'too-many']);
  });
});

describe('displayFileName', () => {
  it('quita caracteres de control y de dirección y acota el largo', () => {
    expect(displayFileName('foto‮gnp.exe')).toBe('fotognp.exe');
    expect(displayFileName('a\u0000b.png')).toBe('ab.png');
    expect(displayFileName('x'.repeat(500)).length).toBe(CHAT_LIMITS.maxFileNameChars);
  });

  it('deja el HTML como texto (el escape lo hace React)', () => {
    expect(displayFileName('<img src=x onerror=alert(1)>.png')).toBe('<img src=x onerror=alert(1)>.png');
  });
});
