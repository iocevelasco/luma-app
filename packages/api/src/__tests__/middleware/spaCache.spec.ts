import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import {
  CACHE_IMMUTABLE,
  CACHE_NEVER,
  CACHE_REVALIDATE,
  setSpaCacheHeaders,
  spaCacheControl,
} from '../../middleware/spaCache.js';

describe('spaCacheControl', () => {
  it('version.json no se guarda nunca', () => {
    expect(spaCacheControl('/app/public/version.json')).toBe(CACHE_NEVER);
  });

  it('index.html se revalida en cada carga', () => {
    expect(spaCacheControl('/app/public/index.html')).toBe(CACHE_REVALIDATE);
  });

  it('los bundles con hash son inmutables', () => {
    expect(spaCacheControl('/app/public/assets/index-BwQ3kz9a.js')).toBe(CACHE_IMMUTABLE);
    expect(spaCacheControl('/app/public/assets/index-D8f2Lm1x.css')).toBe(CACHE_IMMUTABLE);
    expect(spaCacheControl('/app/public/assets/index-BwQ3kz9a.js.map')).toBe(CACHE_IMMUTABLE);
    expect(spaCacheControl('C:\\app\\public\\assets\\vendor-_a-1B2c3.js')).toBe(CACHE_IMMUTABLE);
  });

  it('un archivo sin hash en assets/ no se vuelve inmutable', () => {
    expect(spaCacheControl('/app/public/assets/README.md')).toBeNull();
    expect(spaCacheControl('/app/public/assets/logo.svg')).toBeNull();
  });

  it('un archivo con forma de hash fuera de assets/ tampoco', () => {
    expect(spaCacheControl('/app/public/auth/hero-abcdefgh.png')).toBeNull();
  });
});

describe('setSpaCacheHeaders', () => {
  it('escribe el header sólo cuando hay política', () => {
    const res = { setHeader: vi.fn() } as unknown as Response;

    setSpaCacheHeaders(res, '/app/public/favicon.svg');
    expect(res.setHeader).not.toHaveBeenCalled();

    setSpaCacheHeaders(res, '/app/public/version.json');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', CACHE_NEVER);
  });
});
