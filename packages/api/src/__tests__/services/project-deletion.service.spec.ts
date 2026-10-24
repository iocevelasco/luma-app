import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { PROJECT_TRASH_RETENTION_DAYS } from '@luma/shared';

const { PROJECT_OWNED, collectFileKeys, purgeDateFrom } = await import(
  '../../services/project-deletion.service.js'
);

describe('purgeDateFrom', () => {
  it('suma los días de retención de la papelera', () => {
    const deletedAt = new Date('2026-01-01T00:00:00.000Z');
    const purgeAt = purgeDateFrom(deletedAt);
    expect((purgeAt.getTime() - deletedAt.getTime()) / 86_400_000).toBe(
      PROJECT_TRASH_RETENTION_DAYS,
    );
  });

  it('son 90 días: tres meses para arrepentirse', () => {
    expect(PROJECT_TRASH_RETENTION_DAYS).toBe(90);
  });
});

describe('collectFileKeys', () => {
  it('encuentra las keys a cualquier profundidad', () => {
    const rows = [
      { _id: 1, photos: [{ key: 'a' }, { key: 'b', nested: { key: 'c' } }] },
      { key: 'd' },
      { name: 'sin archivos' },
    ];
    expect(collectFileKeys(rows).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignora un `key` que no es texto', () => {
    expect(collectFileKeys([{ key: 5 }, { key: null }])).toEqual([]);
  });
});

/**
 * El purgado borra lo que figura en `PROJECT_OWNED`. Un modelo nuevo con un
 * campo `project` que nadie sumó ahí deja cobros, gastos o archivos huérfanos
 * para siempre: este test hace que ese olvido rompa el build.
 */
describe('PROJECT_OWNED', () => {
  it('cubre todo modelo que referencia una obra', async () => {
    // Registra todos los modelos, aunque nadie los haya importado todavía.
    await Promise.all(Object.values(import.meta.glob('../../models/*.ts')).map((load) => load()));

    const owned = new Set(PROJECT_OWNED.map(({ model }) => model.modelName));
    // El propio Project no se referencia a sí mismo; se borra al final.
    const referencing = mongoose
      .modelNames()
      .filter((name) => name !== 'Project')
      .filter((name) => mongoose.model(name).schema.path('project'));

    expect(referencing.length).toBeGreaterThan(10);
    expect(referencing.filter((name) => !owned.has(name))).toEqual([]);
  });
});
