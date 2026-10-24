import { describe, expect, it } from 'vitest';
import { LEGAL_VERSION, hasAcceptedCurrentTerms } from './index.js';

describe('hasAcceptedCurrentTerms', () => {
  it('es verdadero sólo con la versión vigente', () => {
    expect(hasAcceptedCurrentTerms(LEGAL_VERSION)).toBe(true);
  });

  it('es falso si nunca aceptó o aceptó otra versión', () => {
    expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
    expect(hasAcceptedCurrentTerms(null)).toBe(false);
    expect(hasAcceptedCurrentTerms('2020-01-01')).toBe(false);
  });
});
