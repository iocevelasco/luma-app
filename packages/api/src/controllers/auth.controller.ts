import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import {
  changeEmailRequestSchema,
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  loginCredentialsSchema,
  registerCredentialsSchema,
  resendVerificationSchema,
  resetPasswordRequestSchema,
  setPasswordRequestSchema,
  type AuthUser,
} from '@luma/shared';
import { isProduction } from '../config/app.config.js';
import { User, type IUser } from '../models/User.js';
import { generateTokens } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { JWTService } from '../services/jwt.service.js';
import { createPersonalOrganization } from '../services/organization.service.js';
import { verifyRecaptchaFromRequest } from '../services/recaptcha.service.js';

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 días
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const ACTIVATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 horas

/**
 * El refresh token vive en una cookie httpOnly y nunca pasa por JavaScript.
 * `sameSite: 'lax'` alcanza porque la SPA y la API comparten origen en producción.
 */
function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}

function toAuthUser(user: IUser): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    picture: user.picture,
    role: user.role,
    email_verified: user.email_verified,
    account_status: user.account_status,
  };
}

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
    const user = await User.findOne({ email }).select('+password');

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: distinguirlos
    // convierte al login en un oráculo de qué direcciones están registradas.
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    }

    if (!user.enabled || user.account_status === 'inactive') {
      return res.status(403).json({ success: false, error: 'La cuenta está deshabilitada' });
    }

    const tokens = generateTokens(String(user._id), user.email, user.role);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      success: true,
      data: { accessToken: tokens.accessToken, user: toAuthUser(user) },
    });
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
    const user = await User.create({
      email,
      name,
      password: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'user',
      email_verified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });

    // Toda cuenta nueva tiene su empresa personal desde el arranque: así nunca
    // hace falta un paso aparte de "creá tu empresa" antes de la primera obra.
    await createPersonalOrganization(String(user._id), name);

    await EmailService.sendEmailVerificationEmail(email, verificationToken, name);

    return res.status(201).json({
      success: true,
      message: 'Cuenta creada. Revisá tu correo para confirmarla.',
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
    const user = await User.findById(payload.sub);

    if (!user || !user.enabled || user.account_status === 'inactive') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ success: false, error: 'Sesión inválida' });
    }

    const tokens = generateTokens(String(user._id), user.email, user.role);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      success: true,
      data: { accessToken: tokens.accessToken, user: toAuthUser(user) },
    });
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
    const user = await User.findById(req.user?.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    return res.json({ success: true, data: { user: toAuthUser(user) } });
  } catch (error) {
    return res.status(500).json({ success: false, error: errMsg(error) });
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
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

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
    }).select('+emailVerificationToken +emailVerificationTokenExpires');

    if (!user) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    user.password = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
    user.email_verified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();

    const tokens = generateTokens(String(user._id), user.email, user.role);
    setRefreshTokenCookie(res, tokens.refreshToken);

    return res.json({
      success: true,
      message: 'Cuenta activada',
      data: { accessToken: tokens.accessToken, user: toAuthUser(user) },
    });
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

    if (!user) {
      return res.status(400).json({ success: false, error: 'El enlace es inválido o venció' });
    }

    user.email_verified = true;
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

    const user = await User.findOne({ email: parsed.data.email });

    if (user && !user.email_verified) {
      const token = randomToken();
      user.emailVerificationToken = token;
      user.emailVerificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
      await user.save();
      await EmailService.sendEmailVerificationEmail(user.email, token, user.name);
    }

    return res.json({ success: true, message: 'Si la cuenta existe, te reenviamos el correo.' });
  } catch (error) {
    console.error('❌ [AUTH] resendVerification:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const parsed = changePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findById(req.user?.sub).select('+password');
    if (!user?.password) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
      return res.status(401).json({ success: false, error: 'La contraseña actual no coincide' });
    }

    user.password = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
    await user.save();

    return res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('❌ [AUTH] changePassword:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function changeEmail(req: Request, res: Response) {
  try {
    const parsed = changeEmailRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const user = await User.findById(req.user?.sub).select('+password');
    if (!user?.password) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    if (!(await bcrypt.compare(parsed.data.password, user.password))) {
      return res.status(401).json({ success: false, error: 'La contraseña no coincide' });
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
    console.error('❌ [AUTH] changeEmail:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
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
