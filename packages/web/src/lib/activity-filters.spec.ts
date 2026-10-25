import { afterEach, describe, expect, it } from 'vitest';
import type { Activity, ActivityStatus } from '@luma/shared';
import {
  applyActivityFilters,
  countActiveFilters,
  EMPTY_ACTIVITY_FILTERS,
  pruneActivityFilters,
  sanitizeActivityFilters,
  type ActivityFilterContext,
  type ActivityFilters,
} from './activity-filters';
import {
  activityFiltersStorageKey,
  loadActivityFilters,
  saveActivityFilters,
} from './activity-filters-storage';

const TODAY = '2026-10-14';

function activity(
  id: string,
  overrides: Partial<Activity> & { status?: ActivityStatus } = {},
): Activity {
  return {
    id,
    projectId: 'p1',
    name: `tarea ${id}`,
    startDate: '2026-10-10',
    endDate: '2026-10-20',
    responsible: { name: 'Juan Pérez' },
    status: 'pendiente',
    specialty: 'pintura',
    evidence: [],
    createdBy: 'u1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

const context: ActivityFilterContext = {
  today: TODAY,
  userId: 'u-me',
  missingMaterialIds: new Set(['m1']),
};

const filters = (patch: Partial<ActivityFilters>): ActivityFilters => ({
  ...EMPTY_ACTIVITY_FILTERS,
  ...patch,
});

const ids = (list: Activity[]) => list.map((item) => item.id);

describe('applyActivityFilters', () => {
  const all = [
    activity('a', { status: 'pendiente' }),
    activity('b', { status: 'en_curso', endDate: '2026-10-01' }),
    activity('m1', { status: 'en_revision', responsible: { name: 'Ana', user: 'u-me' } }),
    activity('d', { status: 'completada', endDate: '2026-10-01' }),
  ];

  it('sin filtros devuelve la misma lista', () => {
    expect(applyActivityFilters(all, EMPTY_ACTIVITY_FILTERS, context)).toBe(all);
  });

  it('dentro de un filtro las opciones suman', () => {
    const result = applyActivityFilters(all, filters({ statuses: ['pendiente', 'en_curso'] }), context);
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('entre filtros restan', () => {
    const result = applyActivityFilters(
      all,
      filters({ statuses: ['pendiente', 'en_curso'], overdue: true }),
      context,
    );
    expect(ids(result)).toEqual(['b']);
  });

  it('atrasadas: vencidas y abiertas — una completada vencida no cuenta', () => {
    expect(ids(applyActivityFilters(all, filters({ overdue: true }), context))).toEqual(['b']);
  });

  it('materiales faltantes usa el conjunto de afuera', () => {
    expect(ids(applyActivityFilters(all, filters({ missingMaterials: true }), context))).toEqual(['m1']);
  });

  it('mías: por el usuario responsable; sin usuario no coincide con nada', () => {
    expect(ids(applyActivityFilters(all, filters({ mine: true }), context))).toEqual(['m1']);
    expect(applyActivityFilters(all, filters({ mine: true }), { ...context, userId: undefined })).toEqual([]);
  });

  it('esperando revisión', () => {
    expect(ids(applyActivityFilters(all, filters({ awaitingReview: true }), context))).toEqual(['m1']);
  });

  it('el texto ignora mayúsculas y acentos, y mira también al responsable', () => {
    expect(ids(applyActivityFilters(all, filters({ text: 'PEREZ' }), context))).toEqual(['a', 'b', 'd']);
    expect(ids(applyActivityFilters(all, filters({ text: 'ana' }), context))).toEqual(['m1']);
  });

  it('responsable por clave', () => {
    const result = applyActivityFilters(all, filters({ responsibles: ['user:u-me'] }), context);
    expect(ids(result)).toEqual(['m1']);
  });
});

describe('countActiveFilters', () => {
  it('cuenta filtros, no opciones', () => {
    expect(countActiveFilters(EMPTY_ACTIVITY_FILTERS)).toBe(0);
    expect(
      countActiveFilters(filters({ statuses: ['pendiente', 'en_curso'], overdue: true, text: '  ' })),
    ).toBe(2);
  });
});

describe('sanitizeActivityFilters', () => {
  it('descarta lo que no reconoce', () => {
    const result = sanitizeActivityFilters({
      text: 'x',
      specialties: ['pintura'],
      statuses: ['en_curso', 'archivada'],
      responsibles: ['user:1', 7],
      mine: 'sí',
      overdue: true,
    });
    expect(result).toEqual(
      filters({ text: 'x', statuses: ['en_curso'], responsibles: ['user:1'], overdue: true }),
    );
  });

  it('un valor que no es objeto da filtros vacíos', () => {
    expect(sanitizeActivityFilters(null)).toEqual(EMPTY_ACTIVITY_FILTERS);
    expect(sanitizeActivityFilters('hola')).toEqual(EMPTY_ACTIVITY_FILTERS);
  });
});

describe('pruneActivityFilters', () => {
  it('suelta responsables que ya no figuran y conserva el resto', () => {
    const result = pruneActivityFilters(
      filters({ responsibles: ['user:1', 'user:2'], overdue: true }),
      new Set(['user:2']),
    );
    expect(result.responsibles).toEqual(['user:2']);
    expect(result.overdue).toBe(true);
  });

  it('devuelve el mismo objeto si no hay nada que soltar', () => {
    const input = filters({ responsibles: ['user:1'] });
    expect(pruneActivityFilters(input, new Set(['user:1']))).toBe(input);
  });
});

describe('almacenamiento', () => {
  const key = activityFiltersStorageKey('u1', 'p1');
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  /** Un `localStorage` en memoria: el del entorno de test no siempre existe. */
  function installStorage(overrides: Partial<Storage> = {}) {
    const data = new Map<string, string>();
    const fake = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      ...overrides,
    } as Storage;
    Object.defineProperty(window, 'localStorage', { value: fake, configurable: true });
    return fake;
  }

  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
    else Reflect.deleteProperty(window, 'localStorage');
  });

  it('guarda, recupera y borra la clave cuando no queda ningún filtro', () => {
    const store = installStorage();
    saveActivityFilters(key, filters({ statuses: ['en_curso'] }));
    expect(loadActivityFilters(key).statuses).toEqual(['en_curso']);

    saveActivityFilters(key, EMPTY_ACTIVITY_FILTERS);
    expect(store.getItem(key)).toBeNull();
  });

  it('la clave es por persona y por obra', () => {
    expect(activityFiltersStorageKey('u1', 'p1')).not.toBe(activityFiltersStorageKey('u2', 'p1'));
    expect(activityFiltersStorageKey('u1', 'p1')).not.toBe(activityFiltersStorageKey('u1', 'p2'));
  });

  it('un JSON roto no rompe: da filtros vacíos', () => {
    installStorage().setItem(key, '{no es json');
    expect(loadActivityFilters(key)).toEqual(EMPTY_ACTIVITY_FILTERS);
  });

  it('si localStorage tira (Safari privado), no rompe ni al leer ni al guardar', () => {
    installStorage({
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(loadActivityFilters(key)).toEqual(EMPTY_ACTIVITY_FILTERS);
    expect(() => saveActivityFilters(key, filters({ overdue: true }))).not.toThrow();
  });

  it('si localStorage no existe, tampoco rompe', () => {
    Reflect.deleteProperty(window, 'localStorage');
    expect(loadActivityFilters(key)).toEqual(EMPTY_ACTIVITY_FILTERS);
    expect(() => saveActivityFilters(key, filters({ overdue: true }))).not.toThrow();
  });
});
