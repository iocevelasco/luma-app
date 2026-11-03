import { beforeEach, describe, expect, it } from 'vitest';
import { stubObjectUrls } from '@/test/chat-fixtures';
import { checkUrl, createLocalPreview, revokeLocalPreview } from './urls';

const ORIGINS = ['https://cdn.example.com'];

describe('checkUrl — enlaces', () => {
  it('acepta https', () => {
    expect(checkUrl('https://react.dev/learn?x=1#a', 'link')).toEqual({
      ok: true,
      url: 'https://react.dev/learn?x=1#a',
    });
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://luma.test/abc',
    'http://react.dev',
    'ftp://react.dev',
    '//react.dev',
    '/relativa',
    'mailto:a@b.c',
  ])('rechaza %s', (url) => {
    expect(checkUrl(url, 'link').ok).toBe(false);
  });

  it('rechaza credenciales embebidas, valores no string y URLs enormes', () => {
    expect(checkUrl('https://user:pass@react.dev', 'link')).toEqual({ ok: false, reason: 'credentials' });
    expect(checkUrl(undefined, 'link').ok).toBe(false);
    expect(checkUrl({ href: 'https://react.dev' }, 'link').ok).toBe(false);
    expect(checkUrl(`https://react.dev/${'a'.repeat(3000)}`, 'link')).toEqual({ ok: false, reason: 'too-long' });
  });
});

describe('checkUrl — imágenes', () => {
  it('sólo acepta orígenes https autorizados', () => {
    expect(checkUrl('https://cdn.example.com/a.png', 'remote-image', ORIGINS).ok).toBe(true);
    expect(checkUrl('https://evil.example.net/a.png', 'remote-image', ORIGINS)).toEqual({ ok: false, reason: 'origin' });
    expect(checkUrl('https://cdn.example.com.evil.net/a.png', 'remote-image', ORIGINS).ok).toBe(false);
    expect(checkUrl('http://cdn.example.com/a.png', 'remote-image', ORIGINS).ok).toBe(false);
    expect(checkUrl('data:image/svg+xml,<svg onload=alert(1)>', 'remote-image', ORIGINS).ok).toBe(false);
  });

  it('por defecto no autoriza ningún origen remoto (la CSP no se debilita)', () => {
    expect(checkUrl('https://cdn.example.com/a.png', 'remote-image').ok).toBe(false);
  });
});

describe('checkUrl — vistas previas blob', () => {
  beforeEach(() => {
    stubObjectUrls();
  });

  it('sólo acepta blobs creados por la app y deja de aceptarlos al revocarlos', () => {
    const url = createLocalPreview(new Blob(['x']));
    expect(checkUrl(url, 'local-preview').ok).toBe(true);
    expect(checkUrl('blob:https://luma.test/forjada', 'local-preview')).toEqual({ ok: false, reason: 'not-local' });
    revokeLocalPreview(url);
    expect(checkUrl(url, 'local-preview').ok).toBe(false);
  });

  it('un blob registrado no sirve como enlace ni como imagen remota', () => {
    const url = createLocalPreview(new Blob(['x']));
    expect(checkUrl(url, 'link').ok).toBe(false);
    expect(checkUrl(url, 'remote-image', ORIGINS).ok).toBe(false);
  });
});
