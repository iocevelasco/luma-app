import { BASE_SPECIALTY_NAMES } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import es from '@/i18n/locales/es/translation.json';

/**
 * La API usa `BASE_SPECIALTY_NAMES` para no dejar crear una especialidad propia
 * con el nombre de una de base. Si el texto de la web cambia y esta lista no, el
 * chequeo deja de coincidir con lo que la persona ve.
 */
describe('nombres de las especialidades de base', () => {
  it('coinciden con los de la web en castellano', () => {
    const labels = es.provider.specialty as Record<string, string>;
    for (const [key, name] of Object.entries(BASE_SPECIALTY_NAMES)) {
      expect(labels[key], key).toBe(name);
    }
    expect(Object.keys(labels).sort()).toEqual(Object.keys(BASE_SPECIALTY_NAMES).sort());
  });
});
