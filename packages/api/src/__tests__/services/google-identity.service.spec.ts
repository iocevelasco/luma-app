import { describe, expect, it, vi } from 'vitest';
import {
  isGoogleAuthoritative,
  verifyGoogleCredential,
  type GoogleVerifier,
} from '../../services/google-identity.service.js';

const CLIENT_ID = 'client.apps.googleusercontent.com';

const payload = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  sub: '1234567890',
  email: 'Ana.Perez+obra@Gmail.com',
  email_verified: true,
  name: 'Ana Pérez',
  ...overrides,
});

const verifierReturning = (value: unknown): GoogleVerifier => vi.fn(async () => value as never);

describe('verifyGoogleCredential', () => {
  it('pide la verificación con nuestro client id como audiencia', async () => {
    const verify = verifierReturning(payload());
    await verifyGoogleCredential('cred', verify, CLIENT_ID);
    expect(verify).toHaveBeenCalledWith('cred', CLIENT_ID);
  });

  it('pasa el correo a minúsculas sin tocar puntos ni +', async () => {
    const identity = await verifyGoogleCredential('cred', verifierReturning(payload()), CLIENT_ID);
    expect(identity).toEqual({
      sub: '1234567890',
      email: 'ana.perez+obra@gmail.com',
      name: 'Ana Pérez',
      hd: undefined,
    });
  });

  it('acepta los dos emisores de Google', async () => {
    await expect(
      verifyGoogleCredential('cred', verifierReturning(payload({ iss: 'accounts.google.com' })), CLIENT_ID),
    ).resolves.toBeTruthy();
  });

  it('una firma, audiencia o vencimiento que no valen es GOOGLE_TOKEN_INVALID', async () => {
    const verify: GoogleVerifier = vi.fn(async () => {
      throw new Error('Wrong recipient, payload audience != requiredAudience');
    });
    await expect(verifyGoogleCredential('cred', verify, CLIENT_ID)).rejects.toMatchObject({
      code: 'GOOGLE_TOKEN_INVALID',
    });
  });

  it('otro emisor es GOOGLE_TOKEN_INVALID', async () => {
    await expect(
      verifyGoogleCredential('cred', verifierReturning(payload({ iss: 'https://evil.example' })), CLIENT_ID),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
  });

  it('sin sub o sin correo es GOOGLE_TOKEN_INVALID', async () => {
    await expect(
      verifyGoogleCredential('cred', verifierReturning(payload({ sub: undefined })), CLIENT_ID),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
    await expect(
      verifyGoogleCredential('cred', verifierReturning(payload({ email: undefined })), CLIENT_ID),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' });
  });

  it('email_verified estricto: sólo true vale', async () => {
    for (const value of [false, 'true', undefined]) {
      await expect(
        verifyGoogleCredential('cred', verifierReturning(payload({ email_verified: value })), CLIENT_ID),
      ).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    }
  });

  it('sin client id la entrega está apagada: SERVICE_UNAVAILABLE, sin llamar a Google', async () => {
    const verify = verifierReturning(payload());
    await expect(verifyGoogleCredential('cred', verify, undefined)).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('isGoogleAuthoritative', () => {
  it('es autoridad sobre @gmail.com', () => {
    expect(isGoogleAuthoritative({ email: 'ana@gmail.com' })).toBe(true);
  });

  it('es autoridad sobre una cuenta de Workspace de ese mismo dominio', () => {
    expect(isGoogleAuthoritative({ email: 'ana@estudio.com', hd: 'estudio.com' })).toBe(true);
  });

  it('no lo es para un correo de otro proveedor con cuenta de Google', () => {
    expect(isGoogleAuthoritative({ email: 'ana@hotmail.com' })).toBe(false);
  });

  it('no lo es si el dominio de Workspace no es el del correo', () => {
    expect(isGoogleAuthoritative({ email: 'ana@estudio.com', hd: 'otro.com' })).toBe(false);
  });
});
