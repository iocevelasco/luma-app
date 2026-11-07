import { describe, expect, it } from 'vitest';
import { isDayInRange, normalizeText } from './normalize-text';

describe('normalizeText', () => {
  it('saca tildes y mayúsculas', () => {
    expect(normalizeText('Fundación Ñandú')).toBe('fundacion nandu');
  });
});

describe('isDayInRange', () => {
  it('incluye los extremos y trata el vacío como sin tope', () => {
    expect(isDayInRange('2026-10-02', '2026-10-02', '2026-10-21')).toBe(true);
    expect(isDayInRange('2026-10-21', '2026-10-02', '2026-10-21')).toBe(true);
    expect(isDayInRange('2026-10-22', '2026-10-02', '2026-10-21')).toBe(false);
    expect(isDayInRange('2026-01-01', '', '')).toBe(true);
    expect(isDayInRange('2026-01-01', '2026-02-01', '')).toBe(false);
  });
});
