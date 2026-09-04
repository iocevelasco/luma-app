import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  switchProjectSchema,
  passwordSchema,
} from '@luma/shared';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { JWTService } from '../services/jwt.service.js';
import { REFRESH_COOKIE_NAME, isProduction } from '../config/app.config.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../utils/errors.js';

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 90 * 24 * 60 * 60 * 1000,
};

/**
 * El refresh token va en cookie httpOnly y el access en el body.
 *
 * Es el reparto que usa Pantera y la razón es la de siempre: el access token
 * lo necesita JavaScript para el header `Authorization`, el refresh no, y lo
 * que JavaScript no toca no se lo lleva un XSS.
 */
function setSession(res: Response, refreshToken: string) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTS);
}

export async function register(req: Request, res: Response) {
  const { email, password, name, phone } = registerSchema.parse(req.body);

  const existing = await UserModel.findOne({ email });
  if (existing) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  const { raw, hashed } = AuthService.generateToken();
  const user = await UserModel.create({
    email,
    name,
    phone,
    password: await AuthService.hashPassword(password),
    emailVerificationToken: hashed,
    emailVerificationTokenExpires: AuthService.tokenExpiry('verify'),
  });

  await EmailService.sendVerification(email, raw, name);

  const session = await AuthService.issueSession(user);
  setSession(res, session.refreshToken);
  res.status(201).json({
    success: true,
    data: { accessToken: session.accessToken, user: session.user },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password, project_id } = loginSchema.parse(req.body);
  const user = await AuthService.authenticate(email, password);
  const session = await AuthService.issueSession(user, project_id);
  setSession(res, session.refreshToken);
  res.json({ success: true, data: { accessToken: session.accessToken, user: session.user } });
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw unauthorized('No hay sesión activa', 'NO_REFRESH_TOKEN');

  let payload;
  try {
    payload = JWTService.verifyRefreshToken(token);
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    throw unauthorized('La sesión venció. Entrá de nuevo.', 'INVALID_REFRESH_TOKEN');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.enabled) throw unauthorized('Cuenta no disponible', 'ACCOUNT_DISABLED');

  // Se re-emite leyendo la membresía de nuevo: si el rol cambió desde que se
  // emitió el token viejo, el nuevo sale con el rol actual.
  const session = await AuthService.issueSession(user, payload.project_id);
  setSession(res, session.refreshToken);
  res.json({ success: true, data: { accessToken: session.accessToken, user: session.user } });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  res.json({ success: true, data: { message: 'Sesión cerrada' } });
}

export async function me(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.sub);
  if (!user) throw notFound('Usuario no encontrado');
  const projects = await AuthService.listProjects(user._id.toString());
  const active = projects.find((p) => p.id === req.user!.project_id) ?? null;
  res.json({
    success: true,
    data: {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      email_verified: user.email_verified,
      project_id: active?.id ?? null,
      project_role: active?.role ?? null,
      projects,
    },
  });
}

/** Cambia el proyecto activo y re-emite el par de tokens con el nuevo scope. */
export async function switchProject(req: Request, res: Response) {
  const { project_id } = switchProjectSchema.parse(req.body);
  const user = await UserModel.findById(req.user!.sub);
  if (!user) throw notFound('Usuario no encontrado');

  const projects = await AuthService.listProjects(user._id.toString());
  if (!projects.some((p) => p.id === project_id)) {
    throw forbidden('No pertenecés a ese proyecto', 'NOT_A_MEMBER');
  }

  const session = await AuthService.issueSession(user, project_id);
  setSession(res, session.refreshToken);
  res.json({ success: true, data: { accessToken: session.accessToken, user: session.user } });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  const user = await UserModel.findOne({ email });

  // Respuesta idéntica exista o no la cuenta: si no, el endpoint es un
  // verificador gratuito de qué emails están registrados.
  if (user) {
    const { raw, hashed } = AuthService.generateToken();
    user.resetToken = hashed;
    user.resetTokenExpires = AuthService.tokenExpiry('reset');
    await user.save();
    await EmailService.sendPasswordReset(user.email, raw);
  }

  res.json({
    success: true,
    data: { message: 'Si el email existe, te mandamos un link para restablecer la contraseña.' },
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetPasswordSchema.parse(req.body);
  const user = await AuthService.findByHashedToken('resetToken', token);

  user.password = await AuthService.hashPassword(password);
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  // Quien probó ser dueño del inbox ya verificó su email de hecho.
  user.email_verified = true;
  await user.save();

  res.json({ success: true, data: { message: 'Contraseña actualizada. Ya podés entrar.' } });
}

/** Alta por invitación: la persona fija su contraseña y activa la cuenta. */
export async function activateAccount(req: Request, res: Response) {
  const { token, password } = z
    .object({ token: z.string().min(10), password: passwordSchema })
    .parse(req.body);

  const user = await AuthService.findByHashedToken('invitationToken', token);
  user.password = await AuthService.hashPassword(password);
  user.email_verified = true;
  user.enabled = true;
  user.invitationToken = undefined;
  user.invitationTokenExpires = undefined;
  await user.save();

  const session = await AuthService.issueSession(user);
  setSession(res, session.refreshToken);
  res.json({ success: true, data: { accessToken: session.accessToken, user: session.user } });
}

export async function verifyEmail(req: Request, res: Response) {
  const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
  const user = await AuthService.findByHashedToken('emailVerificationToken', token);
  user.email_verified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationTokenExpires = undefined;
  await user.save();
  res.json({ success: true, data: { message: 'Email confirmado' } });
}

export async function resendVerification(req: Request, res: Response) {
  const user = await UserModel.findById(req.user!.sub);
  if (!user) throw notFound('Usuario no encontrado');
  if (user.email_verified) throw badRequest('Tu email ya está confirmado', 'ALREADY_VERIFIED');

  const { raw, hashed } = AuthService.generateToken();
  user.emailVerificationToken = hashed;
  user.emailVerificationTokenExpires = AuthService.tokenExpiry('verify');
  await user.save();
  await EmailService.sendVerification(user.email, raw, user.name);

  res.json({ success: true, data: { message: 'Te reenviamos el email de confirmación' } });
}

export async function changePassword(req: Request, res: Response) {
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  const user = await UserModel.findById(req.user!.sub).select('+password');
  if (!user?.password) throw notFound('Usuario no encontrado');

  const ok = await AuthService.comparePassword(current_password, user.password);
  if (!ok) throw unauthorized('La contraseña actual no es correcta', 'BAD_CREDENTIALS');

  user.password = await AuthService.hashPassword(new_password);
  await user.save();
  res.json({ success: true, data: { message: 'Contraseña actualizada' } });
}

export async function updateProfile(req: Request, res: Response) {
  const body = z
    .object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .parse(req.body);

  const user = await UserModel.findByIdAndUpdate(
    new mongoose.Types.ObjectId(req.user!.sub),
    body,
    { new: true },
  );
  if (!user) throw notFound('Usuario no encontrado');
  res.json({
    success: true,
    data: { id: user._id.toString(), email: user.email, name: user.name, phone: user.phone },
  });
}
