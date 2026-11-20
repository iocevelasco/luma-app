import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.JWT_ACCESS_TTL = '7d';
process.env.JWT_REFRESH_TTL = '90d';

vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../services/email.service.js', () => ({ EmailService: {} }));
vi.mock('../../services/organization.service.js', () => ({ createPersonalOrganization: vi.fn() }));
vi.mock('../../services/subscription.service.js', () => ({ startTrialFor: vi.fn() }));
vi.mock('../../services/recaptcha.service.js', () => ({ verifyRecaptchaFromRequest: vi.fn() }));

const { User } = await import('../../models/User.js');
const { JWTService } = await import('../../services/jwt.service.js');
const { refreshToken } = await import('../../controllers/auth.controller.js');

const base = { sub: 'user-1', email: 'ana@estudio.com', roles: ['user' as const] };

function account(tokenVersion?: number) {
  const user = {
    _id: 'user-1',
    email: 'ana@estudio.com',
    name: 'Ana',
    role: 'user',
    enabled: true,
    account_status: 'active',
    email_verified: true,
    tokenVersion,
  };
  vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as never);
}

async function refreshWith(token: string) {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  await refreshToken({ cookies: { refresh_token: token } } as never, res);
  return res;
}

describe('refreshToken — una sesión cerrada no se renueva', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con la versión vigente renueva y el token nuevo lleva esa versión', async () => {
    account(2);
    const res = await refreshWith(JWTService.generateRefreshToken({ ...base, tv: 2 }));

    expect(res.status).not.toHaveBeenCalled();
    const { accessToken } = vi.mocked(res.json).mock.calls[0]![0].data;
    expect(JWTService.verifyAccessToken(accessToken).tv).toBe(2);
  });

  it('un refresh de antes de recuperar la contraseña responde 401 y borra la cookie', async () => {
    account(3);
    const res = await refreshWith(JWTService.generateRefreshToken({ ...base, tv: 2 }));

    expect(res.status).toHaveBeenCalledWith(401);
    expect(vi.mocked(res.json).mock.calls[0]![0]).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.clearCookie).toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('un refresh sin `tv` sigue valiendo mientras la cuenta esté en 0: el deploy no cierra sesiones', async () => {
    account(undefined);
    const res = await refreshWith(JWTService.generateRefreshToken(base));

    expect(res.status).not.toHaveBeenCalled();
  });
});
