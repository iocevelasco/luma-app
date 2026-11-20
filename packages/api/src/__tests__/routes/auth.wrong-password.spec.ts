import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * "Cambiar contraseña" y "Cambiar correo" piden la contraseña de la cuenta para
 * confirmar. Si no coincide, la respuesta **no puede ser un 401**: el cliente
 * lee todo 401 con token como sesión vencida —renueva, reintenta y, con el
 * segundo 401, cierra la sesión— así que escribir mal la contraseña deslogueaba
 * a la persona en vez de avisarle en el formulario.
 *
 * Sobre HTTP real (el router de auth, `normalizeErrors` y `errorHandler` en el
 * orden de `index.ts`), sin base de datos: lo que importa acá es el status y el
 * `code` que salen por el cable, que es lo único que ve el cliente.
 */
vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn(), exists: vi.fn() } }));
vi.mock('../../services/email.service.js', () => ({
  EmailService: { sendEmailChangeConfirmationEmail: vi.fn() },
}));
vi.mock('../../services/jwt.service.js', () => ({
  JWTService: {
    // Cualquier token vale: lo que se prueba viene después de `isAuthenticated`.
    verifyAccessToken: vi.fn(() => ({ sub: 'user-1', email: 'ana@estudio.com', roles: ['user'] })),
  },
}));
// La versión de sesión (tokenVersion) no es lo que se prueba acá: siempre vigente.
vi.mock('../../services/session.service.js', () => ({
  currentTokenVersion: vi.fn().mockResolvedValue(0),
  tokenVersionOf: vi.fn(() => 0),
  forgetTokenVersion: vi.fn(),
}));
// El router de auth importa todos los controllers, y algunos cargan el storage.
vi.mock('../../services/storage.service.js', () => ({
  signObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  openObject: vi.fn(),
  uploadMaterialPhoto: vi.fn(),
  uploadProjectDocument: vi.fn(),
  uploadEvidencePhoto: vi.fn(),
  uploadMilestoneAttachment: vi.fn(),
  uploadSubscriptionReceipt: vi.fn(),
  StorageNotConfiguredError: class extends Error {},
}));

const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { authRouter } = await import('../../routes/auth.js');
const { normalizeErrors } = await import('../../middleware/normalizeErrors.js');
const { errorHandler } = await import('../../middleware/errorHandler.js');

const PASSWORD = 'La-clave-de-Ana-1';
const WRONG_PASSWORD = 'no-es-la-clave-de-Ana';
// Costo mínimo: acá importa que el hash sea de verdad, no que sea lento.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(normalizeErrors);
  app.use('/api/auth', authRouter);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => vi.clearAllMocks());

function aUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'user-1',
    email: 'ana@estudio.com',
    name: 'Ana Pérez',
    password: PASSWORD_HASH as string | undefined,
    pendingEmail: undefined as string | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** `User.findById(...).select('+password')` resuelve a esta cuenta. */
function accountIs<T extends ReturnType<typeof aUser>>(user: T): T {
  vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(user) } as never);
  return user;
}

async function post(path: string, payload: unknown, { token = true } = {}) {
  const response = await fetch(`${base}/api/auth${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer un-token' } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('POST /api/auth/change-password', () => {
  const changePassword = (currentPassword: string, options?: { token: boolean }) =>
    post('/change-password', { currentPassword, newPassword: 'Una-clave-nueva-2' }, options);

  it('con la contraseña actual equivocada responde 403 WRONG_PASSWORD, no un 401', async () => {
    const user = accountIs(aUser());

    const { status, body } = await changePassword(WRONG_PASSWORD);

    expect(status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: 'La contraseña actual no es correcta.',
      code: 'WRONG_PASSWORD',
    });
    // No se tocó nada: la contraseña sigue siendo la que era.
    expect(user.save).not.toHaveBeenCalled();
    expect(user.password).toBe(PASSWORD_HASH);
  });

  it('con la correcta la cambia', async () => {
    const user = accountIs(aUser());

    const { status, body } = await changePassword(PASSWORD);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(await bcrypt.compare('Una-clave-nueva-2', user.password!)).toBe(true);
  });

  it('una cuenta sin contraseña sigue recibiendo el 404 de siempre', async () => {
    accountIs(aUser({ password: undefined }));

    const { status, body } = await changePassword(WRONG_PASSWORD);

    expect(status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('sin sesión sigue siendo un 401: ése sí le dice al cliente que no hay sesión', async () => {
    const { status, body } = await changePassword(PASSWORD, { token: false });

    expect(status).toBe(401);
    expect(body.code).toBe('UNAUTHENTICATED');
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('una contraseña nueva inválida sigue siendo un 400 de validación', async () => {
    accountIs(aUser());

    const { status, body } = await post('/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'corta',
    });

    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION');
  });

  it('una falla inesperada sigue siendo un 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error('se cayó mongo')),
    } as never);

    const { status, body } = await changePassword(PASSWORD);

    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL');
    spy.mockRestore();
  });
});

describe('POST /api/auth/change-email', () => {
  const changeEmail = (password: string) =>
    post('/change-email', { newEmail: 'ana.nueva@estudio.com', password });

  it('con la contraseña equivocada responde 403 WRONG_PASSWORD, no un 401', async () => {
    const user = accountIs(aUser());

    const { status, body } = await changeEmail(WRONG_PASSWORD);

    expect(status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: 'La contraseña actual no es correcta.',
      code: 'WRONG_PASSWORD',
    });
    // Ni se guarda el correo pendiente ni sale el mail de confirmación.
    expect(user.save).not.toHaveBeenCalled();
    expect(user.pendingEmail).toBeUndefined();
    expect(EmailService.sendEmailChangeConfirmationEmail).not.toHaveBeenCalled();
  });

  it('sin la contraseña correcta no dice si el correo nuevo ya está en uso', async () => {
    accountIs(aUser());
    vi.mocked(User.exists).mockResolvedValue({ _id: 'otra-cuenta' } as never);

    const { status, body } = await changeEmail(WRONG_PASSWORD);

    expect(status).toBe(403);
    expect(body.code).toBe('WRONG_PASSWORD');
    expect(User.exists).not.toHaveBeenCalled();
  });

  it('con la correcta deja el correo pendiente y manda la confirmación a la dirección nueva', async () => {
    const user = accountIs(aUser());
    vi.mocked(User.exists).mockResolvedValue(null as never);

    const { status, body } = await changeEmail(PASSWORD);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(user.pendingEmail).toBe('ana.nueva@estudio.com');
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(EmailService.sendEmailChangeConfirmationEmail).toHaveBeenCalledWith(
      'ana.nueva@estudio.com',
      expect.any(String),
      'Ana Pérez',
    );
  });

  it('una cuenta sin contraseña sigue recibiendo el 404 de siempre', async () => {
    accountIs(aUser({ password: undefined }));

    const { status, body } = await changeEmail(WRONG_PASSWORD);

    expect(status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });
});
