import type { Request } from 'express';
import { User, type IUser } from '../models/User.js';
import { createPersonalOrganization } from './organization.service.js';
import { startTrialFor } from './subscription.service.js';
import { termsAcceptanceFields } from './terms.service.js';

/**
 * El alta de una cuenta, la misma con contraseña (`register`) y con Google.
 *
 * Toda cuenta nueva sale con su Empresa personal y su mes de prueba ya
 * corriendo, y con la aceptación de los Términos asentada. Si algo de eso
 * falla después de crear el usuario, el usuario se borra: un alta a medias
 * dejaba un correo tomado por una cuenta sin Empresa, y el reintento chocaba
 * con "ya existe una cuenta con ese email".
 */
export interface NewAccount {
  email: string;
  name: string;
  /** Hash de bcrypt. Sin él la cuenta entra sólo con Google. */
  passwordHash?: string;
  emailVerified: boolean;
  /** Token de verificación de correo, si la cuenta nace sin verificar. */
  verification?: { token: string; expires: Date };
  google?: { sub: string; email: string };
}

export async function createAccount(input: NewAccount, req: Request): Promise<IUser> {
  const user = await User.create({
    email: input.email,
    name: input.name,
    ...(input.passwordHash && { password: input.passwordHash }),
    role: 'user',
    email_verified: input.emailVerified,
    ...termsAcceptanceFields(req),
    ...(input.verification && {
      emailVerificationToken: input.verification.token,
      emailVerificationTokenExpires: input.verification.expires,
    }),
    ...(input.google && { googleSub: input.google.sub, googleEmail: input.google.email }),
  });

  try {
    // Quien se registra solo arranca su mes gratis ya. Los invitados no pasan
    // por acá: su prueba arranca con su primera obra (ver createProject).
    const organization = await createPersonalOrganization(String(user._id), input.name);
    await startTrialFor(String(organization._id), String(user._id));
  } catch (error) {
    await User.deleteOne({ _id: user._id }).catch(() => undefined);
    throw error;
  }

  return user;
}
