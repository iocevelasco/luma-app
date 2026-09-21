import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { Project, type IProject } from '../models/Project.js';
import { ProjectClient } from '../models/ProjectClient.js';
import { OrganizationMember } from '../models/OrganizationMember.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      project?: IProject;
      /** Estricto: sólo quien creó la obra. Gatea presupuesto e invitaciones. */
      isProjectOwner?: boolean;
      /** Dueño **o** Asistente de Obra. Gatea la escritura operativa. */
      isProjectEditor?: boolean;
    }
  }
}

/**
 * Carga la obra de `:projectId` y confirma acceso: dueño, Asistente de Obra
 * (miembro de la misma Empresa) o cliente invitado. Siempre 404 si no hay
 * acceso, nunca 403 — un 403 confirma que la obra existe, y el NFR de
 * aislamiento entre clientes distintos pide justo lo contrario. Ir siempre
 * después de `isAuthenticated`.
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

    const isOwner = String(project.createdBy) === req.user.sub;
    const isAssistant =
      !isOwner &&
      Boolean(
        await OrganizationMember.exists({
          organization: project.organization,
          user: req.user.sub,
          role: 'member',
        }),
      );
    const hasClientAccess =
      !isOwner &&
      !isAssistant &&
      Boolean(await ProjectClient.exists({ project: project._id, user: req.user.sub }));

    if (!isOwner && !isAssistant && !hasClientAccess) {
      return res.status(404).json({ success: false, error: 'Obra no encontrada' });
    }

    req.project = project;
    req.isProjectOwner = isOwner;
    req.isProjectEditor = isOwner || isAssistant;
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

/** Sólo quien gestiona la obra: presupuesto, invitar cliente. Ir siempre después de `requireProjectAccess`. */
export function requireProjectOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.isProjectOwner) {
    return res
      .status(403)
      .json({ success: false, error: 'Sólo el dueño de la obra puede hacer esto' });
  }
  next();
}

/** Dueño o Asistente de Obra: escritura operativa (actividades, materiales, personal). */
export function requireProjectEditor(req: Request, res: Response, next: NextFunction) {
  if (!req.isProjectEditor) {
    return res
      .status(403)
      .json({ success: false, error: 'No tenés permiso para editar esta obra' });
  }
  next();
}
