import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@luma/shared';
import { JWT_CONFIG, JWT_USE_HS256 } from '../config/app.config.js';

/**
 * Emisión y verificación de tokens.
 *
 * Soporta HS256 (secreto compartido) y RS256 (par de claves). La elección la
 * hace la configuración, no el llamador: acá adentro es un `if` y afuera no
 * existe.
 */
export class JWTService {
  private static signingKey(): string {
    const key = JWT_USE_HS256 ? JWT_CONFIG.SECRET : JWT_CONFIG.PRIVATE_KEY_PEM;
    if (!key) throw new Error('JWT no está configurado (falta JWT_SECRET o la clave privada)');
    return key;
  }

  private static verifyingKey(): string {
    const key = JWT_USE_HS256 ? JWT_CONFIG.SECRET : JWT_CONFIG.PUBLIC_KEY_PEM;
    if (!key) throw new Error('JWT no está configurado (falta JWT_SECRET o la clave pública)');
    return key;
  }

  private static algorithm(): 'HS256' | 'RS256' {
    return JWT_USE_HS256 ? 'HS256' : 'RS256';
  }

  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.signingKey(), {
      algorithm: this.algorithm(),
      expiresIn: JWT_CONFIG.ACCESS_TTL,
    } as jwt.SignOptions);
  }

  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign({ ...payload, type: 'refresh' }, this.signingKey(), {
      algorithm: this.algorithm(),
      expiresIn: JWT_CONFIG.REFRESH_TTL,
    } as jwt.SignOptions);
  }

  private static verify(token: string): JWTPayload & { type?: string } {
    try {
      return jwt.verify(token, this.verifyingKey(), {
        algorithms: [this.algorithm()],
      }) as JWTPayload & { type?: string };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw new Error('Token expirado');
      if (error instanceof jwt.JsonWebTokenError) throw new Error('Token inválido');
      throw error;
    }
  }

  static verifyAccessToken(token: string): JWTPayload {
    const decoded = this.verify(token);
    // Un refresh token vale mucho más rato que uno de acceso. Aceptarlo como
    // access convertiría los 7 días en 90 sin que nadie lo note.
    if (decoded.type === 'refresh') throw new Error('Se usó un refresh token como access token');
    return decoded;
  }

  static verifyRefreshToken(token: string): JWTPayload {
    const decoded = this.verify(token);
    if (decoded.type !== 'refresh') throw new Error('Tipo de token inválido');
    return decoded;
  }
}
