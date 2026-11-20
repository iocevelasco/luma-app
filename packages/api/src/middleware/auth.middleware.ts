import type { NextFunction, Request, Response } from 'express';
import type { JWTPayload, UserRole } from '@luma/shared';
import { JWTService } from '../services/jwt.service.js';
import { currentTokenVersion, tokenVersionOf } from '../services/session.service.js';
import { getUserRoles, hasRole, isAdmin as checkIsAdmin } from '../utils/roles.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

/**
 * Firma válida **y** sesión vigente. La firma sola no alcanza: el access token
 * dura días, y una cuenta que recuperó su contraseña tiene que dejar afuera
 * ya a quien entró con la vieja. Por eso compara el `tv` del token con
 * `User.tokenVersion` (con un caché corto, ver `session.service.ts`).
 */
export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  let payload: JWTPayload;
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    payload = JWTService.verifyAccessToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return res.status(401).json({ success: false, error: message });
  }

  try {
    const current = await currentTokenVersion(payload.sub);
    if (current === null || tokenVersionOf(payload) !== current) {
      return res
        .status(401)
        .json({ success: false, error: 'Tu sesión se cerró. Vuelve a entrar.', code: 'UNAUTHENTICATED' });
    }
  } catch (error) {
    // La base no contestó: es un 500, no una sesión inválida. Cerrarle la
    // sesión a todo el mundo por un corte de Mongo sería peor.
    return next(error);
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  if (!checkIsAdmin(getUserRoles(req.user))) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

export function requireRole(role: UserRole | UserRole[]) {
  const requiredRoles = Array.isArray(role) ? role : [role];
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!hasRole(getUserRoles(req.user), requiredRoles)) {
      return res
        .status(403)
        .json({ success: false, error: `Required role: ${requiredRoles.join(' or ')}` });
    }
    next();
  };
}
