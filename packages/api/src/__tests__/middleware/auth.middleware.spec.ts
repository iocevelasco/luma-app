import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

process.env.JWT_SECRET = 'test-secret-key-for-unit-tests-only';
process.env.JWT_ACCESS_TTL = '7d';
process.env.JWT_REFRESH_TTL = '90d';

vi.mock('../../services/session.service.js', () => ({
  currentTokenVersion: vi.fn(),
  tokenVersionOf: (payload: { tv?: number }) => (typeof payload.tv === 'number' ? payload.tv : 0),
}));

const { currentTokenVersion } = await import('../../services/session.service.js');
const { JWTService } = await import('../../services/jwt.service.js');
const { isAuthenticated } = await import('../../middleware/auth.middleware.js');

const base = { sub: 'user-1', email: 'ana@estudio.com', roles: ['user' as const] };

async function run(token: string | null) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} } as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await isAuthenticated(req, res, next);
  return { req, res, next: next as unknown as ReturnType<typeof vi.fn> };
}

describe('isAuthenticated — sesión vigente, no sólo firma válida', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deja pasar un token con la versión vigente', async () => {
    vi.mocked(currentTokenVersion).mockResolvedValue(2);
    const { req, next } = await run(JWTService.generateAccessToken({ ...base, tv: 2 }));

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.sub).toBe('user-1');
  });

  it('un token de antes de recuperar la contraseña responde 401 UNAUTHENTICATED', async () => {
    vi.mocked(currentTokenVersion).mockResolvedValue(3);
    const { req, res, next } = await run(JWTService.generateAccessToken({ ...base, tv: 2 }));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(vi.mocked(res.json).mock.calls[0]![0]).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(req.user).toBeUndefined();
  });

  it('un token sin `tv` (emitido antes del cambio) vale mientras la cuenta siga en 0', async () => {
    vi.mocked(currentTokenVersion).mockResolvedValue(0);
    const { next } = await run(JWTService.generateAccessToken(base));
    expect(next).toHaveBeenCalledWith();

    vi.mocked(currentTokenVersion).mockResolvedValue(1);
    const second = await run(JWTService.generateAccessToken(base));
    expect(second.res.status).toHaveBeenCalledWith(401);
  });

  it('una cuenta que ya no existe responde 401', async () => {
    vi.mocked(currentTokenVersion).mockResolvedValue(null);
    const { res } = await run(JWTService.generateAccessToken({ ...base, tv: 0 }));
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('si la base no contesta es un error del servidor, no una sesión cerrada', async () => {
    const boom = new Error('mongo caído');
    vi.mocked(currentTokenVersion).mockRejectedValue(boom);
    const { res, next } = await run(JWTService.generateAccessToken({ ...base, tv: 0 }));

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sin token o con un refresh token no consulta la base', async () => {
    const none = await run(null);
    expect(none.res.status).toHaveBeenCalledWith(401);

    const refresh = await run(JWTService.generateRefreshToken({ ...base, tv: 0 }));
    expect(refresh.res.status).toHaveBeenCalledWith(401);
    expect(currentTokenVersion).not.toHaveBeenCalled();
  });
});
