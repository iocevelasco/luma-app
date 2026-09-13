import { describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@luma/shared';

// El entorno se arma ANTES del import del servicio: `app.config.ts` lee
// process.env al evaluarse, así que un `beforeAll` llegaría tarde. Por eso el
// import es dinámico y va después de estas asignaciones.
process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.JWT_ACCESS_TTL = '7d';
process.env.JWT_REFRESH_TTL = '90d';

const { JWTService } = await import('../../services/jwt.service.js');

const basePayload = {
  sub: 'user-1',
  email: 'test@test.com',
  roles: ['admin'] as UserRole[],
};

describe('JWTService.generateAccessToken()', () => {
  it('returns a JWT string', () => {
    const token = JWTService.generateAccessToken(basePayload);
    expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it('generates different tokens on each call (iat changes)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));
    const t1 = JWTService.generateAccessToken(basePayload);
    vi.setSystemTime(new Date('2024-01-02'));
    const t2 = JWTService.generateAccessToken(basePayload);
    vi.useRealTimers();
    expect(t1).not.toBe(t2);
  });
});

describe('JWTService.verifyAccessToken()', () => {
  it('verifies a valid access token and returns payload', () => {
    const token = JWTService.generateAccessToken(basePayload);
    const decoded = JWTService.verifyAccessToken(token);
    expect(decoded.sub).toBe(basePayload.sub);
    expect(decoded.email).toBe(basePayload.email);
    expect(decoded.roles).toEqual(basePayload.roles);
  });

  it('throws on tampered token', () => {
    const token = JWTService.generateAccessToken(basePayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => JWTService.verifyAccessToken(tampered)).toThrow('Invalid token');
  });

  it('throws when a refresh token is used as an access token', () => {
    const refresh = JWTService.generateRefreshToken(basePayload);
    expect(() => JWTService.verifyAccessToken(refresh)).toThrow(/refresh token used as access token/i);
  });
});

describe('JWTService.generateRefreshToken()', () => {
  it('generates a token with type=refresh in payload', () => {
    const token = JWTService.generateRefreshToken(basePayload);
    const decoded = JWTService.verifyRefreshToken(token);
    expect(decoded.sub).toBe(basePayload.sub);
  });
});

describe('JWTService.verifyRefreshToken()', () => {
  it('throws when an access token is used as a refresh token', () => {
    const access = JWTService.generateAccessToken(basePayload);
    expect(() => JWTService.verifyRefreshToken(access)).toThrow('Invalid token type');
  });

  it('throws on invalid token', () => {
    expect(() => JWTService.verifyRefreshToken('not.a.token')).toThrow();
  });
});
