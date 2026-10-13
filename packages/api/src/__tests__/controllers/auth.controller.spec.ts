import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

/**
 * Reenviar la verificación. Una cuenta creada por invitación no tiene
 * contraseña: lo que le falta es elegirla (mail de activación), no confirmar
 * el correo. Mandarle el de verificación la dejaba "verificada" y sin poder
 * entrar nunca.
 */
vi.mock('../../models/User.js', () => ({ User: { findOne: vi.fn() } }));
vi.mock('../../services/email.service.js', () => ({
  EmailService: {
    sendAccountActivationEmail: vi.fn(),
    sendEmailVerificationEmail: vi.fn(),
  },
}));
vi.mock('../../services/auth.service.js', () => ({ generateTokens: vi.fn() }));
vi.mock('../../services/jwt.service.js', () => ({ JWTService: {} }));
vi.mock('../../services/organization.service.js', () => ({ createPersonalOrganization: vi.fn() }));
vi.mock('../../services/recaptcha.service.js', () => ({ verifyRecaptchaFromRequest: vi.fn() }));

const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { resendVerification } = await import('../../controllers/auth.controller.js');

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** `User.findOne(...).select('+password')` resuelve al usuario. */
function foundUser(user: Record<string, unknown> | null) {
  vi.mocked(User.findOne).mockReturnValue({
    select: vi.fn().mockResolvedValue(user),
  } as never);
}

function aUser(overrides: Record<string, unknown> = {}) {
  return {
    email: 'ana@estudio.com',
    name: 'Ana Pérez',
    email_verified: false,
    password: undefined as string | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('resendVerification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a una cuenta sin contraseña le manda el mail de ACTIVACIÓN, no el de verificación', async () => {
    const user = aUser();
    foundUser(user);

    await resendVerification({ body: { email: 'ana@estudio.com' } } as never, mockRes());

    expect(EmailService.sendAccountActivationEmail).toHaveBeenCalledWith(
      'ana@estudio.com',
      expect.any(String),
      'Ana Pérez',
    );
    expect(EmailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    expect(user.save).toHaveBeenCalled();
  });

  it('también rescata a una cuenta sin contraseña que ya figura como verificada', async () => {
    foundUser(aUser({ email_verified: true }));

    await resendVerification({ body: { email: 'ana@estudio.com' } } as never, mockRes());

    expect(EmailService.sendAccountActivationEmail).toHaveBeenCalled();
  });

  it('a una cuenta registrada con contraseña y sin verificar le manda el de verificación', async () => {
    foundUser(aUser({ password: 'hash' }));

    await resendVerification({ body: { email: 'ana@estudio.com' } } as never, mockRes());

    expect(EmailService.sendEmailVerificationEmail).toHaveBeenCalled();
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it('a una cuenta completa (contraseña y verificada) no le manda nada', async () => {
    foundUser(aUser({ password: 'hash', email_verified: true }));

    await resendVerification({ body: { email: 'ana@estudio.com' } } as never, mockRes());

    expect(EmailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it('contesta igual exista o no la cuenta: no enumera direcciones', async () => {
    foundUser(null);
    const missing = mockRes();
    await resendVerification({ body: { email: 'nadie@estudio.com' } } as never, missing);

    foundUser(aUser());
    const existing = mockRes();
    await resendVerification({ body: { email: 'ana@estudio.com' } } as never, existing);

    expect(vi.mocked(missing.json).mock.calls[0]![0]).toEqual(
      vi.mocked(existing.json).mock.calls[0]![0],
    );
  });
});
