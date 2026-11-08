import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasBeenSentToFirstProject, markSentToFirstProject } from './first-project-redirect';

/** Un almacenamiento en memoria: el entorno de test no trae uno confiable. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

function useStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = memoryStorage();
  Object.defineProperty(window, name, { value: storage, configurable: true });
  return storage;
}

let storage: Storage;
beforeEach(() => {
  storage = useStorage('sessionStorage');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('rebote al alta de la primera obra', () => {
  it('rebota una sola vez por sesión', () => {
    expect(hasBeenSentToFirstProject()).toBe(false);
    markSentToFirstProject();
    expect(hasBeenSentToFirstProject()).toBe(true);
  });

  it('sin sessionStorage cuenta como ya enviada: nunca entra en un bucle', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(hasBeenSentToFirstProject()).toBe(true);
  });

  it('marcar sin almacenamiento no tira', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => markSentToFirstProject()).not.toThrow();
  });
});
