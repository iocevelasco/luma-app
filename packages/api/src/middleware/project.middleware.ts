import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import {
  canInProject,
  capabilitiesInProject,
  type Capability,
  type ProjectRole,
} from '@luma/shared';
import { Project, type IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      project?: IProject;
      /** Rol de quien hace la request **en esta obra**, resuelto una sola vez. */
      projectRole?: ProjectRole;
      /**
       * ¿Puede hacer esto acá? Única forma de preguntar por un permiso en un
       * controller. Pregunta por capacidad, nunca por rol: cuando entre un
       * rol nuevo, la grilla de `@luma/shared` es el único lugar a tocar.
       */
      can?: (capability: Capability) => boolean;
    }
  }
}

/**
 * Carga la obra de `:projectId` y resuelve el rol de quien la pide: `gerente`
 * si la creó, o lo que diga su fila de `ProjectMembership`.
 *
 * Siempre 404 si no hay acceso, nunca 403 — un 403 confirma que la obra
 * existe, y el NFR de aislamiento entre clientes distintos pide justo lo
 * contrario. Ir siempre después de `isAuthenticated`.
 *
 * Ya no hay acceso por ser miembro de la Empresa: el Asistente de Obra de la
 * v1 entraba a todas las obras de su Empresa, y el supervisor de la matriz de
 * roles es supervisor de UNA obra. La migración
 * `scripts/migrate-project-memberships.ts` convierte a cada Asistente en una
 * membresía explícita por obra, así que nadie pierde acceso — pero si no
 * corrió, los Asistentes quedan afuera. Es a propósito: preferimos que falte
 * un permiso a que sobre.
 */
export async function requireProjectAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Obra no encontrada' });
    }

    const role = await resolveProjectRole(project, req.user.sub);
    if (!role) {
      return res.status(404).json({ success: false, error: 'Obra no encontrada' });
    }

    attachProjectRole(req, project, role);
    next();
  } catch (error) {
    // Un id con formato inválido también "no existe" — no es un 500.
    if (error instanceof mongoose.Error.CastError) {
      return res.status(404).json({ success: false, error: 'Obra no encontrada' });
    }
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return res.status(500).json({ success: false, error: message });
  }
}

/** El rol de esta persona en esta obra, o `null` si no tiene ninguno. */
export async function resolveProjectRole(
  project: IProject,
  userId: string,
): Promise<ProjectRole | null> {
  if (String(project.createdBy) === userId) return 'gerente';

  const membership = await ProjectMembership.findOne({
    project: project._id,
    user: userId,
  }).select('role');

  return membership?.role ?? null;
}

/** Deja la obra, el rol y el `can` colgados de la request. */
function attachProjectRole(req: Request, project: IProject, role: ProjectRole) {
  const can = (capability: Capability) => canInProject(role, capability, project);

  req.project = project;
  req.projectRole = role;
  req.can = can;
}

/** Todo lo que esta persona puede hacer en esta obra, flags ya aplicados. */
export function projectCapabilitiesFor(project: IProject, role: ProjectRole): Capability[] {
  return capabilitiesInProject(role, project);
}

/**
 * Gate por capacidad. Reemplaza a `requireProjectOwner`/`requireProjectEditor`:
 * el router pasa a declarar **qué acción es**, y quién puede hacerla lo
 * decide la grilla. Ir siempre después de `requireProjectAccess`.
 */
export function requireCapability(capability: Capability) {
  return function capabilityGate(req: Request, res: Response, next: NextFunction) {
    if (req.can?.(capability)) return next();

    return res.status(403).json({
      success: false,
      error: 'No tenés permiso para hacer esto en esta obra',
      code: 'FORBIDDEN_CAPABILITY',
      details: { capability },
    });
  };
}
