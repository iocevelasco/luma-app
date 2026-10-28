import { Flag } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import es from '@/i18n/locales/es/translation.json';
import esES from '@/i18n/locales/es-ES/translation.json';
import pt from '@/i18n/locales/pt/translation.json';
import { RELEASE_NOTES, unseenReleaseNotes, type ReleaseNote } from './release-notes';
import { loadLastSeen, RELEASE_SEEN_KEY, saveLastSeen } from './release-notes-storage';
import { checkAndInvalidateOnVersionChange } from './version-manager';

const note = (id: string): ReleaseNote => ({ id, date: id, items: [{ kind: 'new', key: 'x', icon: Flag }] });
// De la más nueva a la más vieja, como en `RELEASE_NOTES`.
const NOTES = [note('2026-10-28'), note('2026-10-20'), note('2026-10-10')];

describe('unseenReleaseNotes', () => {
  it('lo que está por encima de la última vista es lo nuevo', () => {
    expect(unseenReleaseNotes(NOTES, '2026-10-10').map((n) => n.id)).toEqual([
      '2026-10-28',
      '2026-10-20',
    ]);
    expect(unseenReleaseNotes(NOTES, '2026-10-20').map((n) => n.id)).toEqual(['2026-10-28']);
  });

  it('si ya vio la última, no hay nada nuevo', () => {
    expect(unseenReleaseNotes(NOTES, '2026-10-28')).toEqual([]);
  });

  it('quien nunca abrió las novedades ve sólo la última como nueva, no todo el historial', () => {
    expect(unseenReleaseNotes(NOTES, null).map((n) => n.id)).toEqual(['2026-10-28']);
  });

  it('una entrada vista que ya no existe cuenta como "sin referencia": sólo la última', () => {
    expect(unseenReleaseNotes(NOTES, '2025-01-01').map((n) => n.id)).toEqual(['2026-10-28']);
  });

  it('sin entradas no hay nada', () => {
    expect(unseenReleaseNotes([], null)).toEqual([]);
  });
});

describe('las novedades publicadas', () => {
  it('no repiten id y van de la más nueva a la más vieja', () => {
    const ids = RELEASE_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort().reverse());
  });

  it.each([
    ['es', es],
    ['es-ES', esES],
    ['pt', pt],
  ])('cada entrada tiene su texto en %s', (_locale, translation) => {
    const entries = translation.releaseNotes.entries as Record<
      string,
      Record<string, { title?: string; description?: string }>
    >;
    for (const entry of RELEASE_NOTES) {
      for (const item of entry.items) {
        const text = entries[entry.id]?.[item.key];
        expect(text?.title, `falta ${entry.id}.${item.key}.title`).toBeTruthy();
        expect(text?.description, `falta ${entry.id}.${item.key}.description`).toBeTruthy();
      }
    }
  });

  it('la fecha es un YYYY-MM-DD válido (se lee con fromDayKey, no con Date)', () => {
    for (const entry of RELEASE_NOTES) expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

/** Un `localStorage` en memoria: el del entorno de test no siempre existe (ver version-manager.spec.ts). */
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

describe('qué novedades vio cada persona', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  function installStorage(storage: Storage) {
    // `release-notes-storage` lee `window.localStorage`; `version-manager`, el global.
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    vi.stubGlobal('localStorage', storage);
  }

  beforeEach(() => {
    installStorage(createMemoryStorage());
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (original) Object.defineProperty(window, 'localStorage', original);
    else Reflect.deleteProperty(window, 'localStorage');
  });

  it('se guarda por persona', () => {
    saveLastSeen('ana', '2026-10-20');
    saveLastSeen('beto', '2026-10-28');

    expect(loadLastSeen('ana')).toEqual({ available: true, id: '2026-10-20' });
    expect(loadLastSeen('beto')).toEqual({ available: true, id: '2026-10-28' });
    expect(loadLastSeen('carla')).toEqual({ available: true, id: null });
  });

  it('un valor guardado que no es JSON no rompe nada', () => {
    window.localStorage.setItem(RELEASE_SEEN_KEY, '{no es json');
    expect(loadLastSeen('ana')).toEqual({ available: true, id: null });

    window.localStorage.setItem(RELEASE_SEEN_KEY, '[1,2]');
    expect(loadLastSeen('ana')).toEqual({ available: true, id: null });
  });

  it('con el storage bloqueado no hay dónde recordarlo: no está disponible y no tira', () => {
    // Safari con los datos del sitio bloqueados: leer `window.localStorage` tira.
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
      configurable: true,
    });

    expect(loadLastSeen('ana')).toEqual({ available: false, id: null });
    expect(() => saveLastSeen('ana', '2026-10-28')).not.toThrow();
  });

  it('sobrevive a un deploy: version-manager limpia el storage pero no esta clave', () => {
    saveLastSeen('ana', '2026-10-28');
    window.localStorage.setItem('app_version', '0.0.1');
    window.localStorage.setItem('otra-cosa', 'se borra');
    vi.stubEnv('VITE_APP_VERSION', '9.9.9');

    expect(checkAndInvalidateOnVersionChange()).toBe(true);

    expect(loadLastSeen('ana')).toEqual({ available: true, id: '2026-10-28' });
    expect(window.localStorage.getItem('otra-cosa')).toBeNull();
  });
});
