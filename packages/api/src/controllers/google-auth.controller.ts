import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import {
  googleAuthRequestSchema,
  googleLinkRequestSchema,
  googleUnlinkRequestSchema,
} from '@luma/shared';
import { REQUIRE_EMAIL_VERIFICATION } from '../config/app.config.js';
import { User, type IUser } from '../models/User.js';
import { EmailService } from '../services/email.service.js';
import {
  isGoogleAuthoritative,
  verifyGoogleCredential,
  type GoogleIdentity,
} from '../services/google-identity.service.js';
import { AUTH_USER_FIELDS, issueSession, toAuthUser } from '../services/session-issue.service.js';
import { forgetTokenVersion } from '../services/session.service.js';
import { createAccount } from '../services/signup.service.js';
import {
  badRequest,
  forbidden,
  googleAlreadyLinked,
  googleLinkRequired,
  googleNotAllowed,
  googleSignupRequired,
  googleUnlinkNeedsPassword,
  isDuplicateKeyError,
  notFound,
  wrongPassword,
} from '../utils/errors.js';
import { randomToken } from './auth.controller.js';

/**
 * Entrar, registrarse, conectar y desconectar con Google (ADR-005 §1).
 *
 * La regla de fondo (ADR-005 §1, cuarta ronda): **Google se une solo a una
 * cuenta con ese correo únicamente si Google es autoridad sobre el correo**
 * (`@gmail.com` o Workspace del mismo dominio). Al unirse, la cuenta queda en
 * manos de quien prueba tener la casilla: se cierran todas las sesiones y se
 * borra la contraseña. Así, si alguien había registrado ese correo antes con
 * una contraseña suya, queda afuera en el acto. Para cualquier otro correo, y
 * para una cuenta que ya tiene otro Google, se conecta poniendo la contraseña.
 *
 * No se guarda ningún token de Google: sólo el `sub` (la identidad) y el
 * correo de esa cuenta, para mostrarlo.
 */

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: { issues: unknown } }): T {
  if (!result.success) throw badRequest('Datos inválidos', result.error.issues);
  return result.data;
}

/** Antes de cualquier escritura (§1.5): quién no entra con Google, aunque la credencial valga. */
function assertCanUseGoogle(user: IUser): void {
  if (user.purgedAt || !user.enabled || user.account_status === 'inactive') {
    throw forbidden('La cuenta está deshabilitada.');
  }
  if (user.role === 'admin') throw googleNotAllowed();
}

function notifyLinkChanged(
  user: IUser,
  googleEmail: string,
  linked: boolean,
  passwordRemoved = false,
): void {
  // Un correo nunca voltea la acción que lo dispara.
  void EmailService.sendGoogleLinkChanged({
    to: user.email,
    name: user.name,
    googleEmail,
    linked,
    passwordRemoved,
  }).catch(() => undefined);
}

/**
 * Une Google a la cuenta que tiene ese correo, cuando Google es autoridad sobre
 * él. Una sola operación condicionada a que la cuenta siga sin Google.
 *
 * Quien entra prueba tener la casilla, y nada de lo que había antes lo prueba:
 * la contraseña pudo elegirla otra persona (registrar un correo ajeno no exige
 * confirmarlo para entrar), igual que un enlace de activación que pasó por
 * otras manos. Por eso se borran la contraseña y todo token pendiente, y se
 * sube `tokenVersion`: cualquier sesión abierta con la contraseña vieja cae ya.
 * Quien de verdad tenía esa contraseña sigue entrando con Google, y puede crear
 * otra con «Olvidé mi contraseña».
 */
async function linkByAuthoritativeEmail(user: IUser, identity: GoogleIdentity): Promise<IUser | null> {
  const linked = await User.findOneAndUpdate(
    { _id: user._id, googleSub: { $exists: false } },
    {
      $set: { googleSub: identity.sub, googleEmail: identity.email, email_verified: true },
      $unset: {
        password: '',
        resetToken: '',
        resetTokenExpires: '',
        emailVerificationToken: '',
        emailVerificationTokenExpires: '',
        pendingEmail: '',
        emailChangeToken: '',
        emailChangeTokenExpires: '',
        activationLinkHeldBy: '',
        claimedViaLinkBy: '',
      },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  ).select(AUTH_USER_FIELDS);
  if (linked) forgetTokenVersion(String(linked._id));
  return linked;
}

/**
 * `POST /api/auth/google` — `{ credential, acceptedTerms? }`.
 *
 * El mismo pedido desde `/login` y desde `/register`: la API no necesita saber
 * de qué pantalla viene. Responde como `login`.
 */
export async function googleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { credential, acceptedTerms } = parseOrThrow(googleAuthRequestSchema.safeParse(req.body));
    const identity = await verifyGoogleCredential(credential);

    // 1. Ya conectada: la identidad es el `sub`, el correo puede haber cambiado.
    const linked = await User.findOne({ googleSub: identity.sub }).select(AUTH_USER_FIELDS);
    if (linked) {
      assertCanUseGoogle(linked);
      return res.json({ success: true, data: issueSession(res, linked) });
    }

    // Sólo contra `email`, nunca contra `pendingEmail`.
    const existing = await User.findOne({ email: identity.email }).select(AUTH_USER_FIELDS);

    // 2. No hay cuenta: se crea, pero sólo con los Términos aceptados.
    if (!existing) {
      if (acceptedTerms !== true) {
        throw googleSignupRequired({ email: identity.email, name: identity.name });
      }
      return await signUpWithGoogle(req, res, identity);
    }

    assertCanUseGoogle(existing);

    // 3. Google es autoridad sobre el correo y la cuenta no tiene otro Google:
    // se une sola. Sirve para la invitada que nunca activó y para quien ya
    // tenía contraseña; en los dos casos la cuenta queda sólo con Google.
    if (!existing.googleSub && isGoogleAuthoritative(identity)) {
      const hadPassword = Boolean(existing.password);
      const linkedNow = await linkByAuthoritativeEmail(existing, identity);
      if (linkedNow) {
        notifyLinkChanged(linkedNow, identity.email, true, hadPassword);
        return res.json({ success: true, data: issueSession(res, linkedNow) });
      }
      // Otro pedido la unió en el medio: un `googleSub` nunca se pisa.
      throw googleLinkRequired();
    }

    // 4. Invitada sin activar, pero Google no es autoridad sobre ese correo: la
    // activa el enlace que llegó a la casilla, no Google.
    if (!existing.password && !existing.googleSub) {
      throw googleLinkRequired('invited');
    }

    // 5. Tiene contraseña y Google no es autoridad, o ya tiene otro Google: se
    // conecta con la contraseña. Un `googleSub` nunca se pisa.
    throw googleLinkRequired();
  } catch (error) {
    return next(error);
  }
}

async function signUpWithGoogle(req: Request, res: Response, identity: GoogleIdentity) {
  // Nace verificada sólo si Google es autoridad sobre el correo. Si no, es un
  // registro como cualquier otro: le llega el correo de verificación.
  const verified = isGoogleAuthoritative(identity) || !REQUIRE_EMAIL_VERIFICATION;
  const verificationToken = randomToken();

  let user: IUser;
  try {
    user = await createAccount(
      {
        email: identity.email,
        name: identity.name,
        emailVerified: verified,
        ...(!verified && {
          verification: {
            token: verificationToken,
            expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
          },
        }),
        google: { sub: identity.sub, email: identity.email },
      },
      req,
    );
  } catch (error) {
    // Dos clics seguidos, o el correo se registró entre la lectura y el alta:
    // el índice único lo frena y la persona vuelve a intentar.
    if (isDuplicateKeyError(error)) throw googleLinkRequired();
    throw error;
  }

  if (!verified) {
    void EmailService.sendEmailVerificationEmail(user.email, verificationToken, user.name).catch(
      () => undefined,
    );
  }

  const created = (await User.findById(user._id).select(AUTH_USER_FIELDS)) ?? user;
  return res.status(201).json({ success: true, data: issueSession(res, created) });
}

/**
 * `POST /api/auth/google/link` — `{ credential, password }`, con sesión.
 *
 * La prueba es la contraseña actual, no el correo: sirve también para quien
 * usa otro correo en Google. La contraseña incorrecta es un 403, nunca un 401.
 */
export async function linkGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const { credential, password } = parseOrThrow(googleLinkRequestSchema.safeParse(req.body));

    const user = await User.findById(req.user?.sub).select(AUTH_USER_FIELDS);
    if (!user) throw notFound('No encontramos tu cuenta.');
    assertCanUseGoogle(user);
    if (!user.password || !(await bcrypt.compare(password, user.password))) {
      throw wrongPassword('La contraseña no es correcta.');
    }

    const identity = await verifyGoogleCredential(credential);

    if (user.googleSub === identity.sub) {
      return res.json({ success: true, data: { user: toAuthUser(user) } });
    }
    if (user.googleSub) {
      throw googleAlreadyLinked('Tu cuenta ya tiene otra cuenta de Google conectada. Desconéctala primero.');
    }

    try {
      const { matchedCount } = await User.updateOne(
        { _id: user._id, googleSub: { $exists: false } },
        { $set: { googleSub: identity.sub, googleEmail: identity.email } },
      );
      if (matchedCount === 0) throw googleAlreadyLinked();
    } catch (error) {
      if (isDuplicateKeyError(error)) throw googleAlreadyLinked();
      throw error;
    }

    user.googleSub = identity.sub;
    user.googleEmail = identity.email;
    notifyLinkChanged(user, identity.email, true);
    return res.json({ success: true, data: { user: toAuthUser(user) } });
  } catch (error) {
    return next(error);
  }
}

/**
 * `DELETE /api/auth/google/link` — `{ password }`, con sesión. Una cuenta sin
 * contraseña no puede: se quedaría sin forma de entrar.
 */
export async function unlinkGoogle(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = parseOrThrow(googleUnlinkRequestSchema.safeParse(req.body));

    const user = await User.findById(req.user?.sub).select(AUTH_USER_FIELDS);
    if (!user) throw notFound('No encontramos tu cuenta.');
    if (!user.googleSub) {
      return res.json({ success: true, data: { user: toAuthUser(user) } });
    }
    if (!user.password) throw googleUnlinkNeedsPassword();
    if (!(await bcrypt.compare(password, user.password))) {
      throw wrongPassword('La contraseña no es correcta.');
    }

    const googleEmail = user.googleEmail ?? '';
    await User.updateOne({ _id: user._id }, { $unset: { googleSub: '', googleEmail: '' } });

    user.googleSub = undefined;
    user.googleEmail = undefined;
    if (googleEmail) notifyLinkChanged(user, googleEmail, false);
    return res.json({ success: true, data: { user: toAuthUser(user) } });
  } catch (error) {
    return next(error);
  }
}
