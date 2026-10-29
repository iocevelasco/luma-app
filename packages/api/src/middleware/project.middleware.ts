import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import {
  canInProject,
  capabilitiesInProject,
  isReadCapability,
  type Capability,
  type ProjectRole,
} from '@luma/shared';
import { Project, type IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { stateFor } from '../services/subscription.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      project?: IProject;
      /** Rol de quien hace la request **en esta obra**, resuelto una sola vez. */
      projectRole?: ProjectRole;
      /** Quien hace la request creó la obra. Sólo lo lee `requireCapability`: el resto pregunta por capacidad. */
      isProjectOwner?: boolean;
      /** Todo lo que puede hacer acá, resuelto una vez. Es lo que viaja en `project.capabilities`. */
      projectCapabilities?: Capability[];
      /**
       * ¿Puede hacer esto acá? Única forma de preguntar por un permiso en un
       * controller. Pregunta por capacidad, nunca por rol: cuando entre un
       * rol nuevo, la grilla de `@luma/shared` es el único lugar a tocar.
       */
      can?: (capability: Capability) => boolean;
      /**
       * La suscripción de la Empresa dueña de la obra venció: `can` ya
       * niega todo lo que no sea `.read`. Vale para todos los roles —un
       * supervisor invitado tampoco escribe en la obra de un dueño vencido—.
       */
      projectReadOnly?: boolean;
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

    const subscription = await stateFor(project.organization);
    attachProjectRole(req, project, role, !subscription.canWrite, req.user.sub);
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

/**
 * ¿Creó la obra? Es lo que separa al dueño de los demás gerentes: la grilla
 * guarda para él unas pocas capacidades (`OWNER_ONLY` en `@luma/shared`).
 */
export function isProjectOwner(project: IProject, userId: string): boolean {
  return String(project.createdBy) === userId;
}

/**
 * El rol de esta persona en esta obra, o `null` si no tiene ninguno. El dueño
 * es `gerente` sin fila; otro gerente lo es por su fila de `ProjectMembership`.
 */
export async function resolveProjectRole(
  project: IProject,
  userId: string,
): Promise<ProjectRole | null> {
  if (isProjectOwner(project, userId)) return 'gerente';

  const membership = await ProjectMembership.findOne({
    project: project._id,
    user: userId,
  }).select('role');

  return membership?.role ?? null;
}

/** Deja la obra, el rol, el `can` y el modo sólo lectura colgados de la request. */
function attachProjectRole(
  req: Request,
  project: IProject,
  role: ProjectRole,
  readOnly: boolean,
  userId: string,
) {
  const isOwner = isProjectOwner(project, userId);
  const can = (capability: Capability) =>
    canInProject(role, capability, project, { isOwner }) &&
    (!readOnly || isReadCapability(capability));

  req.project = project;
  req.projectRole = role;
  req.isProjectOwner = isOwner;
  req.projectReadOnly = readOnly;
  req.can = can;
  req.projectCapabilities = projectCapabilitiesFor(project, role, userId, readOnly);
}

/**
 * Todo lo que esta persona puede hacer en esta obra, flags, suscripción y
 * titularidad ya aplicados. Es lo que la UI recibe: no deriva nada.
 */
export function projectCapabilitiesFor(
  project: IProject,
  role: ProjectRole,
  userId: string,
  readOnly = false,
): Capability[] {
  return capabilitiesInProject(role, project, {
    readOnly,
    isOwner: isProjectOwner(project, userId),
  });
}

/**
 * Gate por capacidad. Reemplaza a `requireProjectOwner`/`requireProjectEditor`:
 * el router pasa a declarar **qué acción es**, y quién puede hacerla lo
 * decide la grilla. Ir siempre después de `requireProjectAccess`.
 */
export function requireCapability(capability: Capability) {
  return function capabilityGate(req: Request, res: Response, next: NextFunction) {
    if (req.can?.(capability)) return next();

    // El rol sí podría, pero la obra está en sólo lectura: no es un permiso
    // que falta, es una suscripción vencida, y la UI tiene que poder decirlo.
    if (req.projectReadOnly && req.projectRole && req.project) {
      if (canInProject(req.projectRole, capability, req.project, { isOwner: req.isProjectOwner })) {
        return res.status(402).json({
          success: false,
          error: 'La suscripción de esta obra venció: está en sólo lectura.',
          code: 'SUBSCRIPTION_REQUIRED',
          details: { capability },
        });
      }
    }

    return res.status(403).json({
      success: false,
      error: 'No tenés permiso para hacer esto en esta obra',
      code: 'FORBIDDEN_CAPABILITY',
      details: { capability },
    });
  };
}
