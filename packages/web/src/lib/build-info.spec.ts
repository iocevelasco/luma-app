import { describe, expect, it } from 'vitest';
import { hasNewBuild, parseBuildInfo } from './build-info';

describe('hasNewBuild', () => {
  const current = { version: '0.2.0', buildTime: '2026-10-13T10:00:00.000Z' };

  it('detecta una versión semver distinta', () => {
    expect(hasNewBuild(current, { version: '0.2.1', buildTime: current.buildTime })).toBe(true);
    expect(hasNewBuild(current, { version: '1.0.0', buildTime: null })).toBe(true);
  });

  it('detecta un deploy sin bump por el buildTime', () => {
    const server = { version: '0.2.0', buildTime: '2026-10-13T12:30:00.000Z' };
    expect(hasNewBuild(current, server)).toBe(true);
  });

  it('no avisa cuando es el mismo build', () => {
    expect(hasNewBuild(current, { ...current })).toBe(false);
  });

  it('no inventa un update si falta el buildTime de alguno de los lados', () => {
    expect(hasNewBuild(current, { version: '0.2.0', buildTime: null })).toBe(false);
    expect(hasNewBuild({ version: '0.2.0', buildTime: null }, current)).toBe(false);
  });
});

describe('parseBuildInfo', () => {
  it('lee un version.json válido', () => {
    const raw = JSON.stringify({ version: '0.2.0', buildTime: '2026-10-13T10:00:00.000Z' });
    expect(parseBuildInfo(raw)).toEqual({
      version: '0.2.0',
      buildTime: '2026-10-13T10:00:00.000Z',
    });
  });

  it('acepta un archivo sin buildTime', () => {
    expect(parseBuildInfo('{"version":"0.1.0"}')).toEqual({ version: '0.1.0', buildTime: null });
  });

  it('descarta el fallback SPA (HTML con 200 en dev)', () => {
    expect(parseBuildInfo('<!doctype html><html></html>')).toBeNull();
  });

  it('descarta JSON truncado o con forma equivocada', () => {
    expect(parseBuildInfo('{"version":"0.2')).toBeNull();
    expect(parseBuildInfo('null')).toBeNull();
    expect(parseBuildInfo('[]')).toBeNull();
    expect(parseBuildInfo('{"version":""}')).toBeNull();
    expect(parseBuildInfo('{"version":2}')).toBeNull();
  });
});
