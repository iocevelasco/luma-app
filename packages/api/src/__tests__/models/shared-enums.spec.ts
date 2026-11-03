import { describe, expect, it } from 'vitest';
import { providerSpecialtySchema } from '@luma/shared';
import { Activity } from '../../models/Activity.js';
import { CrewMember } from '../../models/CrewMember.js';
import { Provider } from '../../models/Provider.js';

/**
 * Las especialidades viven en `@luma/shared` y los modelos de Mongoose las
 * repiten como arrays de strings que el typecheck no cubre: si una especialidad
 * nueva falta en uno, el error aparece recién al guardar. Este test lo adelanta.
 */
const TRADES = providerSpecialtySchema.options.filter((specialty) => specialty !== 'materiales');

function enumOf(model: { schema: { path: (name: string) => { enumValues?: unknown[] } } }) {
  return [...((model.schema.path('specialty').enumValues ?? []) as string[])].sort();
}

describe('las listas de Mongoose acompañan a @luma/shared', () => {
  // Activity ya no tiene un enum: acepta además las propias de la obra (`custom_…`).
  function activityRejects(specialty: string) {
    return Boolean(new Activity({ specialty }).validateSync()?.errors.specialty);
  }

  it('Activity acepta los oficios y las propias de la obra (no «materiales»)', () => {
    for (const trade of TRADES) expect(activityRejects(trade), trade).toBe(false);
    expect(activityRejects('custom_yeseria')).toBe(false);
    expect(activityRejects('materiales')).toBe(true);
    expect(activityRejects('yeseria')).toBe(true);
  });

  it('CrewMember acepta los oficios (no «materiales»)', () => {
    expect(enumOf(CrewMember)).toEqual([...TRADES].sort());
  });

  it('Provider acepta todas las especialidades', () => {
    expect(enumOf(Provider)).toEqual([...providerSpecialtySchema.options].sort());
  });

  it('el sistema contra incendio se puede guardar en los tres', () => {
    for (const model of [CrewMember, Provider]) {
      expect(enumOf(model)).toContain('fire_protection');
    }
    expect(new Activity({ specialty: 'fire_protection' }).validateSync()?.errors.specialty).toBeUndefined();
  });
});
