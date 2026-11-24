import { describe, expect, it } from 'vitest';
import { landingLegalUrl } from './landing-url';

describe('landingLegalUrl', () => {
  it('en local apunta al puerto de la landing', () => {
    expect(
      landingLegalUrl('terminos', { protocol: 'http:', hostname: 'localhost', port: '6173' }),
    ).toBe('http://localhost:5174/legal/terminos');
  });

  it('en producción queda en el mismo origen', () => {
    expect(
      landingLegalUrl('privacidad', { protocol: 'https:', hostname: 'luma.example', port: '' }),
    ).toBe('/legal/privacidad');
  });
});
