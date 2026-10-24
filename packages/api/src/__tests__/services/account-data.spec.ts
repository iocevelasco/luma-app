import mongoose, { type Schema, type SchemaType } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { PERSONAL_FIELDS, USER_REFERENCES } from '../../services/account-purge.service.js';

/**
 * La Política promete borrar los datos personales. Estos dos tests hacen que
 * esa promesa no se pueda romper sin querer: un modelo nuevo que guarda una
 * persona, o un campo que parece un dato personal, tiene que decir qué pasa
 * con él al purgar la cuenta — o el build falla.
 */
async function registerAllModels() {
  await Promise.all(Object.values(import.meta.glob('../../models/*.ts')).map((load) => load()));
}

function referencedUserPaths(schema: Schema, prefix = ''): string[] {
  const found: string[] = [];
  schema.eachPath((path, type) => {
    const t = type as SchemaType & {
      schema?: Schema;
      caster?: { options?: { ref?: unknown } };
    };
    const full = `${prefix}${path}`;
    if (t.options?.ref === 'User' || t.caster?.options?.ref === 'User') found.push(full);
    if (t.schema) found.push(...referencedUserPaths(t.schema, `${full}.`));
  });
  return found;
}

function personalLookingPaths(schema: Schema): string[] {
  const found: string[] = [];
  schema.eachPath((path) => {
    if (/(^|\.)(email|phone|picture|bank|payerId|reference|cedula|contact\w*)$/i.test(path)) found.push(path);
  });
  return found;
}

describe('inventario de datos personales', () => {
  it('toda referencia a User está clasificada', async () => {
    await registerAllModels();
    const unclassified: string[] = [];
    for (const name of mongoose.modelNames()) {
      for (const path of referencedUserPaths(mongoose.model(name).schema)) {
        if (!USER_REFERENCES[name]?.[path]) unclassified.push(`${name}.${path}`);
      }
    }
    expect(unclassified).toEqual([]);
  });

  it('no hay clasificaciones de campos que ya no existen', async () => {
    await registerAllModels();
    const stale: string[] = [];
    for (const [name, paths] of Object.entries(USER_REFERENCES)) {
      const real = referencedUserPaths(mongoose.model(name).schema);
      for (const path of Object.keys(paths)) if (!real.includes(path)) stale.push(`${name}.${path}`);
    }
    expect(stale).toEqual([]);
  });

  it('todo campo que parece un dato personal dice qué se hace con él', async () => {
    await registerAllModels();
    const unclassified: string[] = [];
    for (const name of mongoose.modelNames()) {
      for (const path of personalLookingPaths(mongoose.model(name).schema)) {
        if (!PERSONAL_FIELDS[name]?.[path]) unclassified.push(`${name}.${path}`);
      }
    }
    expect(unclassified).toEqual([]);
  });
});
