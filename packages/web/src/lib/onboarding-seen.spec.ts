import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSeenTour, markTourSeen, tourStorageKey } from './onboarding-seen';

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
  storage = useStorage('localStorage');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('recorrido de bienvenida: ya lo vi', () => {
  it('cada nivel se recuerda por separado y por persona', () => {
    expect(hasSeenTour('home', 'u1')).toBe(false);
    markTourSeen('home', 'u1');
    expect(hasSeenTour('home', 'u1')).toBe(true);
    // El otro nivel y otra persona siguen sin verlo.
    expect(hasSeenTour('project', 'u1')).toBe(false);
    expect(hasSeenTour('home', 'u2')).toBe(false);
  });

  it('los dos niveles usan claves distintas', () => {
    expect(tourStorageKey('home', 'u1')).not.toBe(tourStorageKey('project', 'u1'));
  });

  it('sin localStorage cuenta como visto: no se muestra en cada visita', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(hasSeenTour('home', 'u1')).toBe(true);
  });

  it('marcar sin almacenamiento no tira', () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => markTourSeen('home', 'u1')).not.toThrow();
  });
});
