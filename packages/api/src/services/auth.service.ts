import type { JWTPayload, UserRole } from '@luma/shared';
import { JWTService } from './jwt.service.js';

/**
 * Emite el par de tokens de una sesión.
 *
 * El access token viaja en el header `Authorization` y el refresh en una cookie
 * httpOnly: el refresh nunca es legible desde JavaScript, así que un XSS puede
 * robar como mucho un access token de vida corta.
 */
export function generateTokens(
  userId: string,
  email: string,
  role: UserRole,
): { accessToken: string; refreshToken: string; payload: Omit<JWTPayload, 'iat' | 'exp'> } {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: userId,
    email,
    roles: [role],
  };

  return {
    accessToken: JWTService.generateAccessToken(payload),
    refreshToken: JWTService.generateRefreshToken(payload),
    payload,
  };
}
