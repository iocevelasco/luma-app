import { providerSpecialtySchema } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import { PROVIDER_SPECIALTIES } from '@/components/providers/provider-form-fields';
import es from '@/i18n/locales/es/translation.json';
import { ACTIVITY_SPECIALTIES } from './activity-catalog';
import { SPECIALTY_ICONS } from './specialty-icons';

/**
 * Las especialidades viven en `@luma/shared` y la web las repite en tres listas
 * escritas a mano. Sin este test, un rubro nuevo puede quedar en el enum y
 * faltar en un selector: la persona no lo encuentra y nadie ve un error.
 */
const ENUM = [...providerSpecialtySchema.options].sort();
const TRADES = ENUM.filter((specialty) => specialty !== 'materiales');

describe('catálogos de especialidades de la web', () => {
  it('el selector de proveedores ofrece todas las del enum', () => {
    expect([...PROVIDER_SPECIALTIES].sort()).toEqual(ENUM);
  });

  it('el selector de actividades ofrece los oficios (no «materiales»)', () => {
    expect([...ACTIVITY_SPECIALTIES].sort()).toEqual(TRADES);
  });

  it('cada una tiene su ícono', () => {
    expect(Object.keys(SPECIALTY_ICONS).sort()).toEqual(ENUM);
  });

  it('cada una tiene su rótulo en castellano', () => {
    const labels = es.provider.specialty as Record<string, string>;
    for (const specialty of ENUM) {
      expect(labels[specialty], `falta provider.specialty.${specialty}`).toBeTruthy();
    }
  });

  it('incluye el sistema contra incendio', () => {
    expect(ACTIVITY_SPECIALTIES).toContain('fire_protection');
    expect(es.provider.specialty.fire_protection).toBe('Sistema contra incendio');
  });
});
