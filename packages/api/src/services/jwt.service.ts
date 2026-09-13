import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@luma/shared';
import { JWT_CONFIG, JWT_USE_HS256 } from '../config/app.config.js';

const useHS256 = JWT_USE_HS256;


export class JWTService {
  /**
   * Generate access token (short-lived)
   */
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    if (useHS256) {
      if (!JWT_CONFIG.SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      return jwt.sign(payload, JWT_CONFIG.SECRET, {
        algorithm: 'HS256',
        expiresIn: JWT_CONFIG.ACCESS_TTL,
      } as jwt.SignOptions);
    } else {
      if (!JWT_CONFIG.PRIVATE_KEY_PEM) {
        throw new Error('JWT_PRIVATE_KEY is not configured');
      }
      return jwt.sign(payload, JWT_CONFIG.PRIVATE_KEY_PEM, {
        algorithm: 'RS256',
        expiresIn: JWT_CONFIG.ACCESS_TTL,
      } as jwt.SignOptions);
    }
  }

  /**
   * Generate refresh token (long-lived)
   */
  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    if (useHS256) {
      if (!JWT_CONFIG.SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }
      return jwt.sign(
        { ...payload, type: 'refresh' },
        JWT_CONFIG.SECRET,
        {
          algorithm: 'HS256',
          expiresIn: JWT_CONFIG.REFRESH_TTL,
        } as jwt.SignOptions
      );
    } else {
      if (!JWT_CONFIG.PRIVATE_KEY_PEM) {
        throw new Error('JWT_PRIVATE_KEY is not configured');
      }
      return jwt.sign(
        { ...payload, type: 'refresh' },
        JWT_CONFIG.PRIVATE_KEY_PEM,
        {
          algorithm: 'RS256',
          expiresIn: JWT_CONFIG.REFRESH_TTL,
        } as jwt.SignOptions
      );
    }
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      let decoded: JWTPayload & { type?: string };
      
      if (useHS256) {
        if (!JWT_CONFIG.SECRET) {
          throw new Error('JWT_SECRET is not configured');
        }
        decoded = jwt.verify(token, JWT_CONFIG.SECRET, {
          algorithms: ['HS256'],
        }) as JWTPayload & { type?: string };
      } else {
        if (!JWT_CONFIG.PUBLIC_KEY_PEM) {
          throw new Error('JWT_PUBLIC_KEY is not configured');
        }
        decoded = jwt.verify(token, JWT_CONFIG.PUBLIC_KEY_PEM, {
          algorithms: ['RS256'],
        }) as JWTPayload & { type?: string };
      }

      if (decoded.type === 'refresh') {
        throw new Error('Invalid token type: refresh token used as access token');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      let decoded: JWTPayload & { type?: string };
      
      if (useHS256) {
        if (!JWT_CONFIG.SECRET) {
          throw new Error('JWT_SECRET is not configured');
        }
        decoded = jwt.verify(token, JWT_CONFIG.SECRET, {
          algorithms: ['HS256'],
        }) as JWTPayload & { type?: string };
      } else {
        if (!JWT_CONFIG.PUBLIC_KEY_PEM) {
          throw new Error('JWT_PUBLIC_KEY is not configured');
        }
        decoded = jwt.verify(token, JWT_CONFIG.PUBLIC_KEY_PEM, {
          algorithms: ['RS256'],
        }) as JWTPayload & { type?: string };
      }

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }
}

