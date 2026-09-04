import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { JWTService } from '../services/jwt.service.js';
import { ProjectMemberModel } from '../models/ProjectMember.js';
import { hasPermission, type JWTPayload, type Permission, type ProjectRole } from '@luma/shared';
import { forbidden, unauthorized } from '../utils/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload;
      /** Proyecto sobre el que opera el request. Es el scope de tenant. */
      projectId?: string;
      /** Rol del usuario DENTRO de ese proyecto. */
      projectRole?: ProjectRole;
    }
  }
}

function parseBearer(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export function isAuthenticated(req: Request, _res: Response, next: NextFunction) {
  const token = parseBearer(req.headers.authorization);
  if (!token) return next(unauthorized('Falta el token de acceso'));
  try {
    req.user = JWTService.verifyAccessToken(token);
    next();
  } catch (error) {
    next(unauthorized(error instanceof Error ? error.message : 'Token inválido'));
  }
}

/**
 * Resuelve el proyecto del request y valida la membresía CONTRA LA BASE.
 *
 * El rol viaja en el token, pero no se confía en él para autorizar: si a
 * alguien lo sacan del proyecto o le bajan el rol, su token sigue siendo
 * válido hasta que expire. Una lectura por request es barata comparada con un
 * ex-integrante que sigue viendo el presupuesto una semana.
 *
 * El proyecto sale del header `X-Project-Id`, del parámetro `:projectId` de la
 * ruta o, si no hay ninguno, del token.
 */
export async function withProject(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());

  const candidate =
    (req.params.projectId as string | undefined) ||
    (req.headers['x-project-id'] as string | undefined) ||
    (req.query.project_id as string | undefined) ||
    req.user.project_id;

  if (!candidate) return next(forbidden('El request no indica proyecto', 'NO_PROJECT'));
  if (!mongoose.Types.ObjectId.isValid(candidate)) {
    return next(forbidden('Proyecto inválido', 'INVALID_PROJECT'));
  }

  try {
    const membership = await ProjectMemberModel.findOne({
      project_id: new mongoose.Types.ObjectId(candidate),
      user_id: new mongoose.Types.ObjectId(req.user.sub),
      status: 'active',
    }).lean();

    if (!membership) {
      // 404 y no 403 a propósito: al que no pertenece al proyecto no se le
      // confirma siquiera que el proyecto existe.
      return next(forbidden('No tenés acceso a este proyecto', 'NOT_A_MEMBER'));
    }

    req.projectId = candidate;
    req.projectRole = membership.role;
    next();
  } catch (error) {
    next(error as Error);
  }
}

/**
 * Autorización por permiso, leída de la matriz del §2.5.
 *
 * Se pide el PERMISO, nunca el rol. Cuando la matriz cambie —y va a cambiar,
 * §13 tiene siete preguntas abiertas— se toca `ROLE_PERMISSIONS` en shared y
 * ninguna ruta se entera.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!req.projectRole) return next(forbidden('El request no indica proyecto', 'NO_PROJECT'));
    if (!hasPermission(req.projectRole, permission)) {
      return next(forbidden('Tu rol no permite esta acción', 'FORBIDDEN_ROLE'));
    }
    next();
  };
}

export function requireProjectRole(...roles: ProjectRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.projectRole || !roles.includes(req.projectRole)) {
      return next(forbidden('Tu rol no permite esta acción', 'FORBIDDEN_ROLE'));
    }
    next();
  };
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}
