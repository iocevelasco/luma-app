import type { Response } from 'express';
import { hasAcceptedCurrentTerms, type AuthUser } from '@luma/shared';
import { GOOGLE_CONFIG, isProduction } from '../config/app.config.js';
import type { IUser } from '../models/User.js';
import { generateTokens } from './auth.service.js';

const REFRESH_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 días

/**
 * Los campos `select: false` que `toAuthUser` necesita para decir si la cuenta
 * tiene contraseña y Google. Todo lugar que arma un `AuthUser` los pide: sin
 * ellos, `has_password` saldría en false a quien sí tiene.
 */
export const AUTH_USER_FIELDS = '+password +googleSub';

export function toAuthUser(user: IUser): AuthUser {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    picture: user.picture,
    role: user.role,
    email_verified: user.email_verified,
    account_status: user.account_status,
    terms_pending: !hasAcceptedCurrentTerms(user.termsVersion),
    has_password: Boolean(user.password),
    google_linked: Boolean(user.googleSub),
    google_email: user.googleSub ? user.googleEmail : undefined,
    google_available: GOOGLE_CONFIG.LOGIN_ENABLED && user.role !== 'admin',
  };
}

/**
 * El refresh token vive en una cookie httpOnly y nunca pasa por JavaScript.
 * `sameSite: 'lax'` alcanza porque la SPA y la API comparten origen en producción.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}

/**
 * Abre una sesión: emite el par de tokens con la versión vigente, deja el
 * refresh en su cookie y devuelve lo que va en `data`. Un solo lugar para los
 * cuatro que abren sesión (login, refresh, activar, Google).
 */
export function issueSession(
  res: Response,
  user: IUser,
  options?: { exposeRefreshToken?: boolean },
): { accessToken: string; user: AuthUser; refreshToken?: string } {
  const tokens = generateTokens(String(user._id), user.email, user.role, user.tokenVersion ?? 0);
  setRefreshTokenCookie(res, tokens.refreshToken);
  return {
    accessToken: tokens.accessToken,
    user: toAuthUser(user),
    // Sólo la app nativa lo pide: lo planta como cookie del WebView. La web
    // sigue recibiéndolo únicamente por Set-Cookie.
    ...(options?.exposeRefreshToken ? { refreshToken: tokens.refreshToken } : {}),
  };
}
