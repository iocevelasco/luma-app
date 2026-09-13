import { describe, expect, it } from 'vitest';
import es from './locales/es/translation.json';
import pt from './locales/pt/translation.json';

/**
 * Paridad de claves entre idiomas: toda clave agregada en es debe existir en
 * pt y viceversa. CLAUDE.md lo exige para todo string nuevo; este test lo hace
 * verificable en CI en vez de depender de la disciplina de cada PR.
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe('i18n parity es ↔ pt', () => {
  const esKeys = new Set(flattenKeys(es));
  const ptKeys = new Set(flattenKeys(pt));

  it('every es key exists in pt', () => {
    const missing = [...esKeys].filter((k) => !ptKeys.has(k));
    expect(missing).toEqual([]);
  });

  it('every pt key exists in es', () => {
    const missing = [...ptKeys].filter((k) => !esKeys.has(k));
    expect(missing).toEqual([]);
  });
});
