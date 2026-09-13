import type { NextFunction, Request, Response } from 'express';
import type { JWTPayload, UserRole } from '@luma/shared';
import { JWTService } from '../services/jwt.service.js';
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

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  try {
    const token = parseBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    req.user = JWTService.verifyAccessToken(token);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    return res.status(401).json({ success: false, error: message });
  }
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
