import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJWT, isTokenExpired, getTokenExpirationTime, getTokenTimeRemaining } from './jwt-utils';

// JWT payload: { sub: "user-1", exp: <timestamp>, iat: <timestamp> }
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${body}.mock-signature`;
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;   // 1h from now
const PAST   = Math.floor(Date.now() / 1000) - 3600;   // 1h ago

describe('decodeJWT()', () => {
  it('decodes a valid token', () => {
    const token = makeToken({ sub: 'user-1', exp: FUTURE });
    const decoded = decodeJWT(token);
    expect(decoded?.sub).toBe('user-1');
    expect(decoded?.exp).toBe(FUTURE);
  });

  it('returns null for a malformed token', () => {
    expect(decodeJWT('not.a.jwt.with.too.many.parts')).toBeNull();
    expect(decodeJWT('onlyone')).toBeNull();
  });

  it('returns null for invalid base64 payload', () => {
    expect(decodeJWT('header.!!!.signature')).toBeNull();
  });
});

describe('isTokenExpired()', () => {
  it('returns false for a future token', () => {
    expect(isTokenExpired(makeToken({ exp: FUTURE }))).toBe(false);
  });

  it('returns true for an expired token', () => {
    expect(isTokenExpired(makeToken({ exp: PAST }))).toBe(true);
  });

  it('returns true when token has no exp claim', () => {
    expect(isTokenExpired(makeToken({ sub: 'user-1' }))).toBe(true);
  });

  it('returns true for a malformed token', () => {
    expect(isTokenExpired('bad-token')).toBe(true);
  });
});

describe('getTokenExpirationTime()', () => {
  it('returns expiration in milliseconds', () => {
    const token = makeToken({ exp: FUTURE });
    expect(getTokenExpirationTime(token)).toBe(FUTURE * 1000);
  });

  it('returns null when no exp claim', () => {
    expect(getTokenExpirationTime(makeToken({ sub: 'user-1' }))).toBeNull();
  });

  it('returns null for malformed token', () => {
    expect(getTokenExpirationTime('bad')).toBeNull();
  });
});

describe('getTokenTimeRemaining()', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns positive milliseconds for a valid future token', () => {
    vi.setSystemTime(new Date(0));
    const exp = 3600; // 1h from epoch
    const token = makeToken({ exp });
    const remaining = getTokenTimeRemaining(token);
    expect(remaining).toBeGreaterThan(0);
  });

  it('returns 0 for an expired token', () => {
    const token = makeToken({ exp: PAST });
    expect(getTokenTimeRemaining(token)).toBe(0);
  });

  it('returns null for malformed token', () => {
    expect(getTokenTimeRemaining('bad')).toBeNull();
  });
});
