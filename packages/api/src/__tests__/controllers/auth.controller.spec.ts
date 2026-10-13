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
vi.mock('../../services/auth.service.js', () => ({
  generateTokens: vi.fn(() => ({ accessToken: 'access', refreshToken: 'refresh' })),
}));
vi.mock('../../services/jwt.service.js', () => ({ JWTService: {} }));
vi.mock('../../services/organization.service.js', () => ({ createPersonalOrganization: vi.fn() }));
vi.mock('../../services/recaptcha.service.js', () => ({ verifyRecaptchaFromRequest: vi.fn() }));

const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { resendVerification, setPassword, resetPassword, verifyEmail } = await import(
  '../../controllers/auth.controller.js'
);

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
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

/**
 * Cuando el mail de activación no sale, quien invitó se lleva el enlace en
 * pantalla. Con él puede elegir la contraseña de esa cuenta, así que usarlo
 * NO prueba que se tenga la casilla: la cuenta anda pero queda sin verificar y
 * atada a esa persona, hasta que la real recupere la contraseña por mail.
 */
describe('cuentas activadas con un enlace que pasó por manos de quien invitó', () => {
  beforeEach(() => vi.clearAllMocks());

  /** `User.findOne(...).select('+...')` resuelve al usuario. */
  function tokenOwner(fields: Record<string, unknown>) {
    const user = {
      _id: 'user-1',
      email: 'ana@estudio.com',
      name: 'Ana Pérez',
      role: 'user',
      email_verified: false,
      save: vi.fn().mockResolvedValue(undefined),
      ...fields,
    };
    vi.mocked(User.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as never);
    return user as typeof user & Record<string, unknown>;
  }

  describe('setPassword', () => {
    const activate = () =>
      setPassword({ body: { token: 'tok', password: 'Una-clave-123' } } as never, mockRes());

    it('con un enlace entregado a mano la cuenta anda, pero no queda verificada y queda atada a quien lo tenía', async () => {
      const user = tokenOwner({ activationLinkHeldBy: 'owner-1' });

      await activate();

      expect(user.password).toEqual(expect.any(String));
      expect(user.email_verified).toBe(false);
      expect(user.claimedViaLinkBy).toBe('owner-1');
      expect(user.activationLinkHeldBy).toBeUndefined();
      expect(user.save).toHaveBeenCalled();
    });

    it('con un enlace que sólo viajó por mail verifica la cuenta', async () => {
      const user = tokenOwner({});

      await activate();

      expect(user.email_verified).toBe(true);
      expect(user.claimedViaLinkBy).toBeUndefined();
    });

    it('no le quita la verificación a una casilla que ya estaba probada', async () => {
      const user = tokenOwner({ activationLinkHeldBy: 'owner-1', email_verified: true });

      await activate();

      expect(user.email_verified).toBe(true);
      expect(user.claimedViaLinkBy).toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('recuperar la contraseña por mail prueba la casilla y borra la marca: la clave anterior ya no vale', async () => {
      const user = tokenOwner({ claimedViaLinkBy: 'owner-1', password: 'hash-de-quien-tuvo-el-enlace' });

      await resetPassword({ body: { token: 'tok', password: 'Clave-de-la-dueña-1' } } as never, mockRes());

      expect(user.password).not.toBe('hash-de-quien-tuvo-el-enlace');
      expect(user.email_verified).toBe(true);
      expect(user.claimedViaLinkBy).toBeUndefined();
      expect(user.activationLinkHeldBy).toBeUndefined();
    });
  });

  describe('verifyEmail', () => {
    it('no verifica una cuenta atada a un enlace: confirmarla dejaría "verificada" una clave que no eligió su dueña', async () => {
      const user = tokenOwner({ claimedViaLinkBy: 'owner-1' });
      const res = mockRes();

      await verifyEmail({ query: { token: 'tok' } } as never, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(user.email_verified).toBe(false);
      expect(user.save).not.toHaveBeenCalled();
    });

    it('tampoco verifica con un token que quien invitó tiene en pantalla', async () => {
      const user = tokenOwner({ activationLinkHeldBy: 'owner-1' });
      const res = mockRes();

      await verifyEmail({ query: { token: 'tok' } } as never, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(user.save).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('a una cuenta atada a un enlace le manda ACTIVACIÓN, aunque ya tenga contraseña, y suelta el enlace en mano', async () => {
      const user = {
        email: 'ana@estudio.com',
        name: 'Ana Pérez',
        email_verified: false,
        password: 'hash',
        claimedViaLinkBy: 'owner-1',
        activationLinkHeldBy: 'owner-1',
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(User.findOne).mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as never);

      await resendVerification({ body: { email: 'ana@estudio.com' } } as never, mockRes());

      expect(EmailService.sendAccountActivationEmail).toHaveBeenCalled();
      expect(EmailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
      expect(user.activationLinkHeldBy).toBeUndefined();
    });
  });
});

