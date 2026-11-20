import type { Capability, ProjectRole } from '@luma/shared';
import { projectCapabilitiesFor } from '../middleware/project.middleware.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { statesFor } from './subscription.service.js';

/**
 * Las obras de una persona, cada una con su rol, sus capacidades y si está en
 * sólo lectura, resueltos con la misma grilla que el panel.
 *
 * Lo usan el listado de obras y el feed de calendario (ADR-005 §3): el feed
 * es otra puerta a los mismos datos y no puede tener su propia idea de quién
 * ve qué. La papelera ya la esconde el hook de `Project`.
 */
export interface MyProject {
  project: IProject;
  role: ProjectRole;
  capabilities: Capability[];
  readOnly: boolean;
}

export async function myProjectsWithAccess(
  userId: string,
  { limit = 100, activeOnly = false }: { limit?: number; activeOnly?: boolean } = {},
): Promise<MyProject[]> {
  // Dos orígenes de acceso y no tres: desde que el supervisor es por obra,
  // ser miembro de la Empresa ya no abre ninguna obra por sí solo.
  const memberships = await ProjectMembership.find({ user: userId }).select('project role');
  const roleByProject = new Map(memberships.map((m) => [String(m.project), m.role]));

  const projects = await Project.find({
    $or: [{ createdBy: userId }, { _id: { $in: memberships.map((m) => m.project) } }],
    ...(activeOnly && { status: { $ne: 'archived' } }),
  })
    .sort({ updatedAt: -1 })
    .limit(limit);

  // Cada obra puede ser de una Empresa distinta (las que me invitaron son
  // de otros): el estado de todas en dos consultas.
  const subscriptions = await statesFor(projects.map((p) => p.organization));

  return projects.map((project) => {
    // El dueño no tiene fila: sale de `createdBy` y gana sobre cualquier
    // membresía (mismo criterio que `requireProjectAccess`). Otro gerente
    // sí la tiene, con `role: 'gerente'`.
    const role: ProjectRole =
      String(project.createdBy) === userId
        ? 'gerente'
        : (roleByProject.get(String(project._id)) as ProjectRole);
    const readOnly = subscriptions.get(String(project.organization))?.canWrite === false;
    return {
      project,
      role,
      capabilities: projectCapabilitiesFor(project, role, userId, readOnly),
      readOnly,
    };
  });
}
