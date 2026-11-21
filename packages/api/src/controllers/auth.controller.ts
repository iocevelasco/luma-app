import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginCredentialsSchema,
  registerCredentialsSchema,
  resendVerificationSchema,
  resetPasswordRequestSchema,
  setPasswordRequestSchema,
  acceptTermsRequestSchema,
} from '@luma/shared';
import { REQUIRE_EMAIL_VERIFICATION } from '../config/app.config.js';
import { User } from '../models/User.js';
import { forgetTokenVersion, tokenVersionOf } from '../services/session.service.js';
import { EmailService } from '../services/email.service.js';
import { JWTService } from '../services/jwt.service.js';
import { termsAcceptanceFields } from '../services/terms.service.js';
import { notFound, passwordNotSet, termsRequired, wrongPassword } from '../utils/errors.js';
import { verifyRecaptchaFromRequest } from '../services/recaptcha.service.js';
import { isAccountActivated } from '../services/activation.service.js';
import { createAccount } from '../services/signup.service.js';
import {
  AUTH_USER_FIELDS,
  clearRefreshTokenCookie,
  issueSession,
  toAuthUser,
} from '../services/session-issue.service.js';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const ACTIVATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 horas

function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = loginCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Credenciales inválidas' });
    }

    const recaptcha = await verifyRecaptchaFromRequest(req, 'login');
    if (!recaptcha.success) {
      return res.status(400).json({ success: false, error: 'Verificación de seguridad fallida' });
    }

    const { email, password } = parsed.data;
    const user = await User.findOne({ email }).select(AUTH_USER_FIELDS);

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: distinguirlos
    // convierte al login en un oráculo de qué direcciones están registradas.
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(401)
        .json({ success: false, error: 'Email o contraseña incorrectos', code: 'INVALID_CREDENTIALS' });
    }

    if (!user.enabled || user.account_status === 'inactive') {
      return res.status(403).json({ success: false, error: 'La cuenta está deshabilitada' });
    }

    return res.json({ success: true, data: issueSession(res, user) });
  } catch (error) {
    console.error('❌ [AUTH] login:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerCredentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const recaptcha = await verifyRecaptchaFromRequest(req, 'register');
    if (!recaptcha.success) {
      return res.status(400).json({ success: false, error: 'Verificación de seguridad fallida' });
    }

    const { email, password, name } = parsed.data;

    if (await User.exists({ email })) {
      return res.status(409).json({ success: false, error: 'Ya existe una cuenta con ese email' });
    }

    const verificationToken = randomToken();
    const user = await createAccount(
      {
        email,
        name,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        emailVerified: !REQUIRE_EMAIL_VERIFICATION,
        ...(REQUIRE_EMAIL_VERIFICATION && {
          verification: {
            token: verificationToken,
            expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
          },
        }),
      },
      req,
    );

    if (REQUIRE_EMAIL_VERIFICATION) {
      await EmailService.sendEmailVerificationEmail(email, verificationToken, name);
    }

    return res.status(201).json({
      success: true,
      message: REQUIRE_EMAIL_VERIFICATION
        ? 'Cuenta creada. Revisa tu correo para confirmarla.'
        : 'Cuenta creada. Ya puedes entrar.',
      data: { user: toAuthUser(user) },
    });
  } catch (error) {
    console.error('❌ [AUTH] register:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No refresh token' });
    }

    const payload = JWTService.verifyRefreshToken(token);
    const user = await User.findById(payload.sub).select(AUTH_USER_FIELDS);

    if (!user || !user.enabled || user.account_status === 'inactive') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, error: 'Sesión inválida' });
    }

    // La cuenta cerró sus sesiones después de emitir este token (recuperó la
    // contraseña): este refresh ya no renueva nada.
    if (tokenVersionOf(payload) !== (user.tokenVersion ?? 0)) {
      clearRefreshTokenCookie(res);
      return res
        .status(401)
        .json({ success: false, error: 'Tu sesión se cerró. Vuelve a entrar.', code: 'UNAUTHENTICATED' });
    }

    return res.json({ success: true, data: issueSession(res, user) });
  } catch (error) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ success: false, error: errMsg(error) });
  }
}

export async function logout(_req: Request, res: Response) {
  clearRefreshTokenCookie(res);
  return res.json({ success: true, message: 'Sesión cerrada' });
}

export async function getCurrentUser(req: Request, res: Response) {
  try {
    const user = await User.findById(req.user?.sub).select(AUTH_USER_FIELDS);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    return res.json({ success: true, data: { user: toAuthUser(user) } });
  } catch (error) {
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Aceptación posterior al alta: cuentas anteriores a los Términos y cambios de
 * versión. Siempre sobre la versión vigente — el cliente no elige cuál acepta.
 */
export async function acceptTerms(req: Request, res: Response, next: NextFunction) {
  try {
    if (!acceptTermsRequestSchema.safeParse(req.body).success) {
      throw termsRequired();
    }

    const user = await User.findByIdAndUpdate(req.user?.sub, termsAcceptanceFields(req), {
      new: true,
    }).select(AUTH_USER_FIELDS);
    if (!user) {
      throw notFound('No encontramos tu cuenta.');
    }
    return res.json({ success: true, data: { user: toAuthUser(user) } });
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const parsed = forgotPasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const user = await User.findOne({ email: parsed.data.email });

    // Respuesta idéntica exista o no la cuenta: si no, este endpoint enumera usuarios.
    if (user) {
      const token = randomToken();
      user.resetToken = token;
      user.resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      await EmailService.sendPasswordResetEmail(user.email, token);
    }

    return res.json({
      success: true,
      message: 'Si existe una cuenta con ese correo, te enviamos las instrucciones.',
    });
  } catch (error) {
    console.error('❌ [AUTH] forgotPassword:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const parsed = resetPasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findOne({
      resetToken: parsed.data.token,
      resetTokenExpires: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpires');

    if (!user) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    user.password = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
    // El enlace viajó sólo por mail: esta contraseña la eligió quien tiene la casilla.
    user.passwordProvenAt = new Date();
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    // El enlace viajó sólo por el mail: usarlo prueba que se tiene la casilla, y
    // la contraseña que había (si la eligió quien tuvo un enlace en mano) ya no vale.
    user.email_verified = true;
    user.activationLinkHeldBy = undefined;
    user.claimedViaLinkBy = undefined;
    // Recuperar la contraseña cierra todas las sesiones abiertas: si alguien
    // entró con la contraseña vieja, o con la que eligió quien tuvo un enlace
    // en mano, sale ahora y no cuando venza su refresh de 90 días.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    // Y desconecta Google (ADR-005 §1.14): si alguien conectó su Google con una
    // contraseña robada, recuperarla tiene que sacarlo también por esa puerta.
    user.googleSub = undefined;
    user.googleEmail = undefined;
    await user.save();
    forgetTokenVersion(String(user._id));

    return res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('❌ [AUTH] resetPassword:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Activación: primera contraseña de una cuenta creada por un admin. */
export async function setPassword(req: Request, res: Response) {
  try {
    const parsed = setPasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findOne({
      emailVerificationToken: parsed.data.token,
      emailVerificationTokenExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationTokenExpires +googleSub');

    // Una cuenta con Google ya está activada: su enlace no elige contraseña.
    if (!user || user.googleSub) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    // Si el mail no salió, este enlace pasó por manos de quien invitó: elegir
    // la contraseña con él no demuestra tener la casilla. La cuenta funciona
    // pero queda sin verificar y atada a quien lo tenía (`claimedViaLinkBy`),
    // y sólo se verifica cuando la persona real recupere la contraseña por mail.
    const heldBy = user.activationLinkHeldBy;
    user.password = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
    Object.assign(user, termsAcceptanceFields(req));
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    user.activationLinkHeldBy = undefined;
    if (heldBy && !user.email_verified) {
      user.claimedViaLinkBy = heldBy;
      user.passwordProvenAt = undefined;
    } else {
      user.email_verified = true;
      user.claimedViaLinkBy = undefined;
      user.passwordProvenAt = new Date();
    }

    // Se escribe condicionado a que siga sin Google, en la misma operación: si
    // entre la lectura y esta escritura la cuenta se activó con Google, este
    // enlace ya no le elige la contraseña (ADR-005 §1.10).
    const { matchedCount } = await User.updateOne(
      { _id: user._id, emailVerificationToken: parsed.data.token, googleSub: { $exists: false } },
      {
        $set: {
          password: user.password,
          email_verified: user.email_verified,
          termsVersion: user.termsVersion,
          termsAcceptedAt: user.termsAcceptedAt,
          termsAcceptedIp: user.termsAcceptedIp,
          termsAcceptedUserAgent: user.termsAcceptedUserAgent,
          ...(user.claimedViaLinkBy && { claimedViaLinkBy: user.claimedViaLinkBy }),
          ...(user.passwordProvenAt && { passwordProvenAt: user.passwordProvenAt }),
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpires: '',
          activationLinkHeldBy: '',
          ...(!user.claimedViaLinkBy && { claimedViaLinkBy: '' }),
          ...(!user.passwordProvenAt && { passwordProvenAt: '' }),
        },
      },
    );
    if (matchedCount === 0) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    return res.json({ success: true, message: 'Cuenta activada', data: issueSession(res, user) });
  } catch (error) {
    console.error('❌ [AUTH] setPassword:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return res.status(400).json({ success: false, error: 'Falta el token' });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationTokenExpires');

    // Verificar no cambia la contraseña. Si la cuenta está atada a un enlace
    // que tuvo otra persona, confirmar el correo la dejaría "verificada" con
    // una contraseña que no eligió su dueño: ahí la salida es recuperarla.
    if (!user || user.activationLinkHeldBy || user.claimedViaLinkBy) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    user.email_verified = true;
    // Quien registró la cuenta (y eligió la contraseña) prueba ahora la casilla.
    user.passwordProvenAt = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();

    return res.json({ success: true, message: '¡Cuenta confirmada!' });
  } catch (error) {
    console.error('❌ [AUTH] verifyEmail:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const user = await User.findOne({ email: parsed.data.email }).select('+password +googleSub');

    // Una cuenta sin contraseña la creó una invitación: lo que le falta es
    // elegirla, no confirmar el mail. Mandarle el de verificación la dejaba
    // "verificada" y sin poder entrar nunca — `/activate` ya no encontraba el
    // token, y era justo el camino al que lleva "Me invitaron" en el login.
    // La respuesta es idéntica en todos los casos: no distingue quién existe.
    // Una cuenta atada a un enlace en mano (`claimedViaLinkBy`) tiene
    // contraseña pero no dueño probado: para ella, "confirmar el correo" no
    // alcanza, tiene que elegir una contraseña desde la casilla. Va por activación.
    // Una cuenta que entra con Google ya está activada aunque no tenga contraseña.
    const needsActivation = (user && !isAccountActivated(user)) || Boolean(user?.claimedViaLinkBy);

    if (user && (!user.email_verified || needsActivation)) {
      const token = randomToken();
      user.emailVerificationToken = token;
      // El token nuevo sólo existe en la casilla: el enlace en mano, si había, murió.
      user.activationLinkHeldBy = undefined;

      if (needsActivation) {
        user.emailVerificationTokenExpires = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
        await user.save();
        await EmailService.sendAccountActivationEmail(user.email, token, user.name);
      } else {
        user.emailVerificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
        await user.save();
        await EmailService.sendEmailVerificationEmail(user.email, token, user.name);
      }
    }

    return res.json({ success: true, message: 'Si la cuenta existe, te reenviamos el correo.' });
  } catch (error) {
    console.error('❌ [AUTH] resendVerification:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Cambiar la contraseña y cambiar el correo piden la contraseña de la cuenta
 * para confirmar. Si no coincide se **lanza** `wrongPassword()` (403), nunca un
 * 401: el cliente lee todo 401 con token como sesión vencida —renueva,
 * reintenta y cierra la sesión—, y eso deslogueaba a quien sólo la había
 * escrito mal.
 */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = changePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findById(req.user?.sub).select('+password');
    if (!user) throw notFound('No encontramos tu cuenta.');
    // Entra sólo con Google: no hay contraseña actual que pedir. La crea por
    // «Olvidé mi contraseña», que prueba la casilla.
    if (!user.password) throw passwordNotSet();

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
      throw wrongPassword();
    }

    user.password = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
    await user.save();

    return res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    return next(error);
  }
}

export async function changeEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = changeEmailRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findById(req.user?.sub).select('+password');
    if (!user) throw notFound('No encontramos tu cuenta.');
    // Sin contraseña no hay con qué confirmar el cambio de correo.
    if (!user.password) {
      throw passwordNotSet(
        'Para cambiar el correo necesitas una contraseña. Créala con «Olvidé mi contraseña».',
      );
    }

    if (!(await bcrypt.compare(parsed.data.password, user.password))) {
      throw wrongPassword();
    }

    if (await User.exists({ email: parsed.data.newEmail })) {
      return res.status(409).json({ success: false, error: 'Ese email ya está en uso' });
    }

    const token = randomToken();
    user.pendingEmail = parsed.data.newEmail;
    user.emailChangeToken = token;
    user.emailChangeTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await user.save();

    // El mail va a la dirección NUEVA: confirmar el cambio exige probar que se
    // tiene acceso a esa casilla, no sólo a la sesión.
    await EmailService.sendEmailChangeConfirmationEmail(parsed.data.newEmail, token, user.name);

    return res.json({ success: true, message: 'Te enviamos un correo a la nueva dirección.' });
  } catch (error) {
    return next(error);
  }
}

export async function confirmEmailChange(req: Request, res: Response) {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      return res.status(400).json({ success: false, error: 'Falta el token' });
    }

    const user = await User.findOne({
      emailChangeToken: token,
      emailChangeTokenExpires: { $gt: new Date() },
    }).select('+emailChangeToken +emailChangeTokenExpires +pendingEmail');

    if (!user?.pendingEmail) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    user.email = user.pendingEmail;
    user.email_verified = true;
    // Pidió el cambio con la contraseña y probó la casilla nueva: es la misma persona.
    user.passwordProvenAt = new Date();
    user.activationLinkHeldBy = undefined;
    user.claimedViaLinkBy = undefined;
    user.pendingEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeTokenExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Correo actualizado' });
  } catch (error) {
    console.error('❌ [AUTH] confirmEmailChange:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export { ACTIVATION_TOKEN_TTL_MS, BCRYPT_ROUNDS, randomToken };
