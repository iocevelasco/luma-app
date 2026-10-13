import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAndInvalidateOnVersionChange } from './version-manager';

// happy-dom no expone localStorage en esta versión (ver api-client.spec.ts).
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('checkAndInvalidateOnVersionChange', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('en la primera ejecución sólo guarda la versión', () => {
    vi.stubEnv('VITE_APP_VERSION', '0.2.0');
    localStorage.setItem('cache-de-pantalla', 'x');

    expect(checkAndInvalidateOnVersionChange()).toBe(false);
    expect(localStorage.getItem('app_version')).toBe('0.2.0');
    expect(localStorage.getItem('cache-de-pantalla')).toBe('x');
  });

  it('al cambiar la versión limpia la caché pero conserva sesión, tema e idioma', () => {
    vi.stubEnv('VITE_APP_VERSION', '0.3.0');
    localStorage.setItem('app_version', '0.2.0');
    localStorage.setItem('auth_token', 'tok');
    localStorage.setItem('auth_user', '{"id":"1"}');
    localStorage.setItem('session_start_time', '1700000000000');
    localStorage.setItem('user-storage', '{}');
    localStorage.setItem('vite-ui-theme', 'dark');
    localStorage.setItem('i18nextLng', 'pt-BR');
    localStorage.setItem('cache-de-pantalla', 'viejo');

    expect(checkAndInvalidateOnVersionChange()).toBe(true);

    expect(localStorage.getItem('app_version')).toBe('0.3.0');
    expect(localStorage.getItem('auth_token')).toBe('tok');
    expect(localStorage.getItem('auth_user')).toBe('{"id":"1"}');
    expect(localStorage.getItem('session_start_time')).toBe('1700000000000');
    expect(localStorage.getItem('user-storage')).toBe('{}');
    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    expect(localStorage.getItem('i18nextLng')).toBe('pt-BR');
    expect(localStorage.getItem('cache-de-pantalla')).toBeNull();
  });

  it('con la misma versión no toca nada', () => {
    vi.stubEnv('VITE_APP_VERSION', '0.3.0');
    localStorage.setItem('app_version', '0.3.0');
    localStorage.setItem('cache-de-pantalla', 'x');

    expect(checkAndInvalidateOnVersionChange()).toBe(false);
    expect(localStorage.getItem('cache-de-pantalla')).toBe('x');
  });
});
