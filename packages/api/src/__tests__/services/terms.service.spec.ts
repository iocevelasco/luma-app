import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { LEGAL_VERSION } from '@luma/shared';
import { termsAcceptanceFields } from '../../services/terms.service.js';

function fakeRequest(userAgent: string | undefined): Request {
  return { ip: '203.0.113.7', get: () => userAgent } as unknown as Request;
}

describe('termsAcceptanceFields', () => {
  it('deja versión, fecha, IP y user agent', () => {
    const fields = termsAcceptanceFields(fakeRequest('Mozilla/5.0'));
    expect(fields.termsVersion).toBe(LEGAL_VERSION);
    expect(fields.termsAcceptedAt).toBeInstanceOf(Date);
    expect(fields.termsAcceptedIp).toBe('203.0.113.7');
    expect(fields.termsAcceptedUserAgent).toBe('Mozilla/5.0');
  });

  it('recorta un user agent desmesurado', () => {
    const fields = termsAcceptanceFields(fakeRequest('x'.repeat(5000)));
    expect(fields.termsAcceptedUserAgent).toHaveLength(300);
  });

  it('tolera un request sin user agent', () => {
    expect(termsAcceptanceFields(fakeRequest(undefined)).termsAcceptedUserAgent).toBeUndefined();
  });
});
