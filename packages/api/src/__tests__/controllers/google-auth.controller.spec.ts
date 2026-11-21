import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';

/**
 * Entrar, registrarse, conectar y desconectar con Google (ADR-005 §1). La
 * regla que estos tests cuidan: Google nunca se une solo a una cuenta que ya
 * tiene contraseña, y un `googleSub` nunca se pisa.
 */
vi.mock('../../models/User.js', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    exists: vi.fn(),
  },
}));
vi.mock('../../services/email.service.js', () => ({
  EmailService: {
    sendGoogleLinkChanged: vi.fn(async () => true),
    sendEmailVerificationEmail: vi.fn(async () => true),
  },
}));
vi.mock('../../services/signup.service.js', () => ({ createAccount: vi.fn() }));
vi.mock('../../services/auth.service.js', () => ({
  generateTokens: vi.fn(() => ({ accessToken: 'access', refreshToken: 'refresh' })),
}));
vi.mock('../../services/google-identity.service.js', async (original) => ({
  ...(await original<typeof import('../../services/google-identity.service.js')>()),
  verifyGoogleCredential: vi.fn(),
}));
vi.mock('../../services/jwt.service.js', () => ({ JWTService: {} }));
vi.mock('../../services/session.service.js', () => ({
  forgetTokenVersion: vi.fn(),
  tokenVersionOf: vi.fn(() => 0),
}));
vi.mock('../../services/organization.service.js', () => ({ createPersonalOrganization: vi.fn() }));
vi.mock('../../services/subscription.service.js', () => ({ startTrialFor: vi.fn() }));
vi.mock('../../services/recaptcha.service.js', () => ({ verifyRecaptchaFromRequest: vi.fn() }));

const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { createAccount } = await import('../../services/signup.service.js');
const { verifyGoogleCredential } = await import('../../services/google-identity.service.js');
const { googleAuth, linkGoogle, unlinkGoogle } = await import(
  '../../controllers/google-auth.controller.js'
);

const PASSWORD = 'La-clave-de-Ana-1';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  return res;
}

function aUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-1',
    email: 'ana@gmail.com',
    name: 'Ana Pérez',
    role: 'user',
    enabled: true,
    account_status: 'active',
    email_verified: true,
    tokenVersion: 0,
    ...overrides,
  };
}

/** Cada `findOne(...).select(...)` devuelve, en orden, lo que se le pase. */
function findOneReturns(...results: unknown[]) {
  for (const result of results) {
    vi.mocked(User.findOne).mockReturnValueOnce({ select: vi.fn().mockResolvedValue(result) } as never);
  }
}

function findByIdReturns(result: unknown) {
  vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(result) } as never);
}

function googleSays(identity: Partial<{ sub: string; email: string; name: string; hd: string }> = {}) {
  vi.mocked(verifyGoogleCredential).mockResolvedValue({
    sub: 'google-sub-1',
    email: 'ana@gmail.com',
    name: 'Ana Pérez',
    ...identity,
  });
}

async function callGoogle(body: Record<string, unknown> = { credential: 'cred' }) {
  const res = mockRes();
  const next = vi.fn() as unknown as NextFunction;
  await googleAuth({ body, ip: '1', get: () => '' } as never, res, next);
  const error = vi.mocked(next).mock.calls[0]?.[0] as { code?: string; details?: unknown } | undefined;
  return { res, error };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(EmailService.sendGoogleLinkChanged).mockResolvedValue(true);
  vi.mocked(EmailService.sendEmailVerificationEmail).mockResolvedValue(true);
});

describe('POST /api/auth/google', () => {
  it('con una cuenta ya conectada a ese sub, abre sesión', async () => {
    googleSays();
    findOneReturns(aUser({ googleSub: 'google-sub-1', password: PASSWORD_HASH }));

    const { res, error } = await callGoogle();

    expect(error).toBeUndefined();
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.anything());
    expect(vi.mocked(res.json).mock.calls[0]![0].data.user.google_linked).toBe(true);
  });

  it('sin cuenta y sin Términos aceptados no crea nada: GOOGLE_SIGNUP_REQUIRED con el correo', async () => {
    googleSays();
    findOneReturns(null, null);

    const { error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_SIGNUP_REQUIRED');
    expect(error?.details).toEqual({ email: 'ana@gmail.com', name: 'Ana Pérez' });
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('sin cuenta y con Términos aceptados la crea verificada si Google es autoridad', async () => {
    googleSays();
    findOneReturns(null, null);
    const created = aUser({ googleSub: 'google-sub-1' });
    vi.mocked(createAccount).mockResolvedValue(created as never);
    findByIdReturns(created);

    const { res, error } = await callGoogle({ credential: 'cred', acceptedTerms: true });

    expect(error).toBeUndefined();
    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@gmail.com',
        emailVerified: true,
        google: { sub: 'google-sub-1', email: 'ana@gmail.com' },
      }),
      expect.anything(),
    );
    expect(vi.mocked(createAccount).mock.calls[0]![0]).not.toHaveProperty('passwordHash');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(EmailService.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('un correo que no es de Gmail ni de Workspace nace sin verificar y recibe el correo', async () => {
    googleSays({ email: 'ana@hotmail.com' });
    findOneReturns(null, null);
    const created = aUser({ email: 'ana@hotmail.com', email_verified: false, googleSub: 'google-sub-1' });
    vi.mocked(createAccount).mockResolvedValue(created as never);
    findByIdReturns(created);

    await callGoogle({ credential: 'cred', acceptedTerms: true });

    expect(vi.mocked(createAccount).mock.calls[0]![0]).toMatchObject({ emailVerified: false });
    expect(EmailService.sendEmailVerificationEmail).toHaveBeenCalled();
  });

  it('una cuenta con contraseña y un Gmail: Google se une solo, se borra la contraseña y se cierran las sesiones', async () => {
    const { forgetTokenVersion } = await import('../../services/session.service.js');
    googleSays();
    findOneReturns(null, aUser({ password: PASSWORD_HASH }));
    const linkedNow = aUser({ googleSub: 'google-sub-1', tokenVersion: 3 });
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockResolvedValue(linkedNow),
    } as never);

    const { res, error } = await callGoogle();

    expect(error).toBeUndefined();
    const [filter, update] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $unset: Record<string, unknown>; $inc: Record<string, unknown> },
    ];
    // Condicionado a que siga sin Google: un `googleSub` nunca se pisa.
    expect(filter).toEqual({ _id: 'user-1', googleSub: { $exists: false } });
    expect(update.$set).toMatchObject({ googleSub: 'google-sub-1', email_verified: true });
    // Quien registró antes ese correo con una contraseña suya queda afuera.
    expect(update.$unset).toMatchObject({ password: '', resetToken: '', pendingEmail: '', claimedViaLinkBy: '' });
    expect(update.$inc).toEqual({ tokenVersion: 1 });
    expect(forgetTokenVersion).toHaveBeenCalledWith('user-1');
    expect(res.cookie).toHaveBeenCalled();
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ linked: true, passwordRemoved: true }),
    );
  });

  it('una cuenta con contraseña y un correo que no es de Gmail ni Workspace: no se toca, GOOGLE_LINK_REQUIRED', async () => {
    googleSays({ email: 'ana@hotmail.com' });
    findOneReturns(null, aUser({ email: 'ana@hotmail.com', password: PASSWORD_HASH }));

    const { error } = await callGoogle({ credential: 'cred', acceptedTerms: true });

    expect(error?.code).toBe('GOOGLE_LINK_REQUIRED');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('una cuenta de Workspace del mismo dominio también se une sola', async () => {
    googleSays({ email: 'ana@estudio.com', hd: 'estudio.com' });
    findOneReturns(null, aUser({ email: 'ana@estudio.com', password: PASSWORD_HASH }));
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockResolvedValue(aUser({ email: 'ana@estudio.com', googleSub: 'google-sub-1' })),
    } as never);

    const { error } = await callGoogle();

    expect(error).toBeUndefined();
    const [, update] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as unknown as [
      unknown,
      { $unset: Record<string, unknown>; $inc?: Record<string, unknown> },
    ];
    expect(update.$unset).toMatchObject({ password: '' });
    expect(update.$inc).toEqual({ tokenVersion: 1 });
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ passwordRemoved: true }),
    );
  });

  it('con una contraseña probada (la eligió quien tiene la casilla) la conserva, y no cierra sesiones', async () => {
    const { forgetTokenVersion } = await import('../../services/session.service.js');
    googleSays();
    findOneReturns(null, aUser({ password: PASSWORD_HASH, passwordProvenAt: new Date('2026-11-01') }));
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockResolvedValue(aUser({ password: PASSWORD_HASH, googleSub: 'google-sub-1' })),
    } as never);

    const { error } = await callGoogle();

    expect(error).toBeUndefined();
    const [, update] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as unknown as [
      unknown,
      { $set: Record<string, unknown>; $unset: Record<string, unknown>; $inc?: unknown },
    ];
    expect(update.$set).toMatchObject({ googleSub: 'google-sub-1' });
    expect(update.$unset).not.toHaveProperty('password');
    expect(update.$inc).toBeUndefined();
    expect(forgetTokenVersion).not.toHaveBeenCalled();
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ passwordRemoved: false }),
    );
  });

  it('si ese Google se unió a otra cuenta en el medio, el índice único lo frena: GOOGLE_ALREADY_LINKED, no un 500', async () => {
    googleSays();
    findOneReturns(null, aUser({ password: PASSWORD_HASH }));
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 })),
    } as never);

    const { error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_ALREADY_LINKED');
  });

  it('si otro pedido la unió en el medio, no pisa nada: GOOGLE_LINK_REQUIRED', async () => {
    googleSays();
    findOneReturns(null, aUser({ password: PASSWORD_HASH }));
    vi.mocked(User.findOneAndUpdate).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);

    const { res, error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_LINK_REQUIRED');
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('una cuenta con ese correo y OTRO sub: GOOGLE_LINK_REQUIRED con reason otherGoogle, el sub no se pisa', async () => {
    googleSays();
    findOneReturns(null, aUser({ googleSub: 'otro-sub' }));

    const { error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_LINK_REQUIRED');
    expect(error?.details).toEqual({ reason: 'otherGoogle' });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('activa una cuenta invitada sin contraseña cuando Google es autoridad, en una sola operación condicionada', async () => {
    googleSays();
    findOneReturns(null, aUser({ email_verified: false }));
    const activated = aUser({ googleSub: 'google-sub-1' });
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockResolvedValue(activated),
    } as never);

    const { res, error } = await callGoogle();

    expect(error).toBeUndefined();
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-1', googleSub: { $exists: false } },
      expect.objectContaining({
        $set: expect.objectContaining({ googleSub: 'google-sub-1', email_verified: true }),
      }),
      expect.anything(),
    );
    expect(res.json).toHaveBeenCalled();
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ linked: true, googleEmail: 'ana@gmail.com', passwordRemoved: false }),
    );
  });

  it('una invitada cuyo correo no es de Gmail ni de Workspace no se activa con Google', async () => {
    googleSays({ email: 'ana@hotmail.com' });
    findOneReturns(null, aUser({ email: 'ana@hotmail.com', email_verified: false }));

    const { error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_LINK_REQUIRED');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('un admin no entra con Google', async () => {
    googleSays();
    findOneReturns(aUser({ role: 'admin', googleSub: 'google-sub-1' }));

    const { error } = await callGoogle();

    expect(error?.code).toBe('GOOGLE_NOT_ALLOWED');
  });

  it('una cuenta dada de baja no entra', async () => {
    googleSays();
    findOneReturns(aUser({ googleSub: 'google-sub-1', enabled: false, account_status: 'inactive' }));

    const { res, error } = await callGoogle();

    expect(error?.code).toBe('FORBIDDEN');
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('dos altas a la vez: el índice único frena la segunda', async () => {
    googleSays();
    findOneReturns(null, null);
    vi.mocked(createAccount).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const { error } = await callGoogle({ credential: 'cred', acceptedTerms: true });

    expect(error?.code).toBe('GOOGLE_LINK_REQUIRED');
  });
});

/**
 * Desde `/activate`, con el token del enlace: activa esa invitada aunque el
 * correo de Google sea otro (ADR-005 §1.9 bis).
 */
describe('POST /api/auth/google con activationToken', () => {
  const activate = () => callGoogle({ credential: 'cred', activationToken: 'tok-activacion' });

  function invited(overrides: Record<string, unknown> = {}) {
    return aUser({ email: 'ana@estudio.com', email_verified: false, ...overrides });
  }

  it('activa la invitada del enlace con un Google de otro correo, en una sola operación condicionada', async () => {
    googleSays({ email: 'ana.perez@gmail.com' });
    findOneReturns(invited());
    vi.mocked(User.exists).mockResolvedValue(null as never);
    const activated = invited({ googleSub: 'google-sub-1', email_verified: true });
    vi.mocked(User.findOneAndUpdate).mockReturnValue({ select: vi.fn().mockResolvedValue(activated) } as never);

    const { res, error } = await activate();

    expect(error).toBeUndefined();
    expect(User.findOne).toHaveBeenCalledTimes(1);
    expect(vi.mocked(User.findOne).mock.calls[0]![0]).toMatchObject({ emailVerificationToken: 'tok-activacion' });
    const [filter, update] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $unset: Record<string, unknown>; $inc?: unknown },
    ];
    expect(filter).toEqual({
      _id: 'user-1',
      emailVerificationToken: 'tok-activacion',
      googleSub: { $exists: false },
      activationLinkHeldBy: { $exists: false },
    });
    expect(update.$set).toEqual({ googleSub: 'google-sub-1', googleEmail: 'ana.perez@gmail.com', email_verified: true });
    expect(update.$unset).toMatchObject({ emailVerificationToken: '', claimedViaLinkBy: '' });
    // Sin contraseña no hay sesiones ajenas que cerrar.
    expect(update.$inc).toBeUndefined();
    expect(res.cookie).toHaveBeenCalled();
  });

  it('con el enlace en manos de quien invitó (el mail no salió) no sirve para Google', async () => {
    googleSays({ email: 'otro@gmail.com' });
    findOneReturns(invited({ activationLinkHeldBy: 'owner-1' }));

    const { res, error } = await activate();

    expect(error?.code).toBe('VALIDATION');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('un enlace vencido o inexistente no activa nada', async () => {
    googleSays();
    findOneReturns(null);

    const { error } = await activate();

    expect(error?.code).toBe('VALIDATION');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('si ese Google ya es de otra cuenta, no entra a esa en silencio: GOOGLE_ALREADY_LINKED', async () => {
    googleSays({ email: 'ana.perez@gmail.com' });
    findOneReturns(invited());
    vi.mocked(User.exists).mockResolvedValue({ _id: 'otra' } as never);

    const { res, error } = await activate();

    expect(error?.code).toBe('GOOGLE_ALREADY_LINKED');
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('una cuenta atada a un enlace en mano (con contraseña) se activa sin esa contraseña y con las sesiones cerradas', async () => {
    const { forgetTokenVersion } = await import('../../services/session.service.js');
    googleSays({ email: 'ana.perez@gmail.com' });
    findOneReturns(invited({ password: PASSWORD_HASH, claimedViaLinkBy: 'owner-1' }));
    vi.mocked(User.exists).mockResolvedValue(null as never);
    vi.mocked(User.findOneAndUpdate).mockReturnValue({
      select: vi.fn().mockResolvedValue(invited({ googleSub: 'google-sub-1' })),
    } as never);

    const { error } = await activate();

    expect(error).toBeUndefined();
    const [, update] = vi.mocked(User.findOneAndUpdate).mock.calls[0] as unknown as [
      unknown,
      { $unset: Record<string, unknown>; $inc?: Record<string, unknown> },
    ];
    expect(update.$unset).toMatchObject({ password: '', claimedViaLinkBy: '' });
    expect(update.$inc).toEqual({ tokenVersion: 1 });
    expect(forgetTokenVersion).toHaveBeenCalledWith('user-1');
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@estudio.com', passwordRemoved: true }),
    );
  });

  it('si el token se usó en el medio (otro clic, o eligió contraseña), no pisa nada', async () => {
    googleSays();
    findOneReturns(invited());
    vi.mocked(User.exists).mockResolvedValue(null as never);
    vi.mocked(User.findOneAndUpdate).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);

    const { res, error } = await activate();

    expect(error?.code).toBe('VALIDATION');
    expect(res.cookie).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/google/link', () => {
  async function link(body: Record<string, unknown>) {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    await linkGoogle({ body, user: { sub: 'user-1' } } as never, res, next);
    return { res, error: vi.mocked(next).mock.calls[0]?.[0] as { code?: string; status?: number } | undefined };
  }

  it('con la contraseña correcta conecta y avisa por correo', async () => {
    findByIdReturns(aUser({ email: 'ana@estudio.com', password: PASSWORD_HASH }));
    googleSays({ email: 'ana.personal@gmail.com' });
    vi.mocked(User.updateOne).mockResolvedValue({ matchedCount: 1 } as never);

    const { res, error } = await link({ credential: 'cred', password: PASSWORD });

    expect(error).toBeUndefined();
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-1', googleSub: { $exists: false } },
      { $set: { googleSub: 'google-sub-1', googleEmail: 'ana.personal@gmail.com' } },
    );
    expect(vi.mocked(res.json).mock.calls[0]![0].data.user).toMatchObject({
      google_linked: true,
      google_email: 'ana.personal@gmail.com',
    });
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalled();
  });

  it('con la contraseña equivocada es WRONG_PASSWORD (403), nunca un 401, y no mira la credencial', async () => {
    findByIdReturns(aUser({ password: PASSWORD_HASH }));

    const { error } = await link({ credential: 'cred', password: 'otra' });

    expect(error?.code).toBe('WRONG_PASSWORD');
    expect(error?.status).toBe(403);
    expect(verifyGoogleCredential).not.toHaveBeenCalled();
  });

  it('si ese Google ya es de otra cuenta: GOOGLE_ALREADY_LINKED', async () => {
    findByIdReturns(aUser({ password: PASSWORD_HASH }));
    googleSays();
    vi.mocked(User.updateOne).mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const { error } = await link({ credential: 'cred', password: PASSWORD });

    expect(error?.code).toBe('GOOGLE_ALREADY_LINKED');
  });

  it('un admin no conecta Google', async () => {
    findByIdReturns(aUser({ role: 'admin', password: PASSWORD_HASH }));

    const { error } = await link({ credential: 'cred', password: PASSWORD });

    expect(error?.code).toBe('GOOGLE_NOT_ALLOWED');
  });
});

describe('DELETE /api/auth/google/link', () => {
  async function unlink(body: Record<string, unknown>) {
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;
    await unlinkGoogle({ body, user: { sub: 'user-1' } } as never, res, next);
    return { res, error: vi.mocked(next).mock.calls[0]?.[0] as { code?: string } | undefined };
  }

  it('con la contraseña desconecta con $unset (nunca null: el índice es disperso)', async () => {
    findByIdReturns(aUser({ password: PASSWORD_HASH, googleSub: 's', googleEmail: 'ana@gmail.com' }));

    const { res, error } = await unlink({ password: PASSWORD });

    expect(error).toBeUndefined();
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-1' },
      { $unset: { googleSub: '', googleEmail: '' } },
    );
    expect(vi.mocked(res.json).mock.calls[0]![0].data.user.google_linked).toBe(false);
    expect(EmailService.sendGoogleLinkChanged).toHaveBeenCalledWith(
      expect.objectContaining({ linked: false }),
    );
  });

  it('una cuenta sin contraseña no puede: se quedaría sin forma de entrar', async () => {
    findByIdReturns(aUser({ googleSub: 's' }));

    const { error } = await unlink({ password: 'lo-que-sea' });

    expect(error?.code).toBe('GOOGLE_UNLINK_NEEDS_PASSWORD');
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  it('con la contraseña equivocada no desconecta', async () => {
    findByIdReturns(aUser({ password: PASSWORD_HASH, googleSub: 's' }));

    const { error } = await unlink({ password: 'otra' });

    expect(error?.code).toBe('WRONG_PASSWORD');
    expect(User.updateOne).not.toHaveBeenCalled();
  });
});
