import type { Request, Response } from 'express';
import {
  capabilitiesInProject,
  createProjectSchema,
  invitableProjectRoleSchema,
  inviteProjectMemberSchema,
  updateProjectSchema,
  type Project as ProjectDTO,
  type ProjectMemberSummary,
  type ProjectRole,
} from '@luma/shared';
import { User } from '../models/User.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { createPersonalOrganization, findMyOrganizationId } from '../services/organization.service.js';
import { EmailService } from '../services/email.service.js';
import { activationDelivery } from '../utils/activation.js';
import { ACTIVATION_TOKEN_TTL_MS, randomToken } from './auth.controller.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toProjectDTO(project: IProject): ProjectDTO {
  return {
    id: String(project._id),
    organizationId: String(project.organization),
    createdBy: String(project.createdBy),
    name: project.name,
    description: project.description,
    location: project.location,
    size: project.size,
    estimatedStartDate: project.estimatedStartDate,
    estimatedEndDate: project.estimatedEndDate,
    currency: project.currency,
    status: project.status,
    providersVisibleToClient: Boolean(project.providersVisibleToClient),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. Ajustes de
 * una obra ya creada — hoy sólo la visibilidad de proveedores para el cliente.
 */
export async function updateProject(req: Request, res: Response) {
  try {
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const current = req.project as IProject;
    const project = await Project.findByIdAndUpdate(current._id, parsed.data, { new: true });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Obra no encontrada' });
    }

    return res.json({ success: true, data: { project: toProjectDTO(project) } });
  } catch (error) {
    console.error('❌ [PROJECT] updateProject:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function createProject(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const organizationId = await findMyOrganizationId(req.user.sub);
    if (!organizationId) {
      return res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    }

    const project = await Project.create({
      ...parsed.data,
      organization: organizationId,
      createdBy: req.user.sub,
    });

    return res.status(201).json({ success: true, data: { project: toProjectDTO(project) } });
  } catch (error) {
    console.error('❌ [PROJECT] createProject:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Obras donde el usuario es dueño, Asistente de Obra (miembro de la Empresa)
 * o tiene acceso como cliente. Sin paginación en v1, tope 100.
 */
export async function listProjects(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const userId = req.user.sub;
    // Dos orígenes de acceso y no tres: desde que el supervisor es por obra,
    // ser miembro de la Empresa ya no abre ninguna obra por sí solo.
    const memberships = await ProjectMembership.find({ user: userId }).select('project role');
    const roleByProject = new Map(memberships.map((m) => [String(m.project), m.role]));

    const projects = await Project.find({
      $or: [{ createdBy: userId }, { _id: { $in: memberships.map((m) => m.project) } }],
    })
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({
      success: true,
      data: {
        projects: projects.map((project) => {
          // El gerente no tiene fila: sale de `createdBy` y gana sobre
          // cualquier membresía (mismo criterio que `requireProjectAccess`).
          const role: ProjectRole =
            String(project.createdBy) === userId
              ? 'gerente'
              : (roleByProject.get(String(project._id)) as ProjectRole);
          return {
            ...toProjectDTO(project),
            role,
            capabilities: capabilitiesInProject(role, project),
          };
        }),
      },
    });
  } catch (error) {
    console.error('❌ [PROJECT] listProjects:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` antes: usa `req.project` y `req.projectRole`. */
export async function getProject(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const role = req.projectRole as ProjectRole;

    return res.json({
      success: true,
      data: {
        project: {
          ...toProjectDTO(project),
          role,
          // Resueltas server-side contra la grilla, con los flags de la obra
          // ya aplicados: la UI pregunta por capacidad y no vuelve a derivar
          // nada. Es lo que permite sumar un rol sin tocar el frontend.
          capabilities: capabilitiesInProject(role, project),
          isOwner: Boolean(req.isProjectOwner),
          isEditor: Boolean(req.isProjectEditor),
        },
        members: await listProjectMembers(project),
      },
    });
  } catch (error) {
    console.error('❌ [PROJECT] getProject:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * El equipo de la obra: el gerente —que no tiene fila de membresía, sale de
 * `createdBy`— seguido de supervisores y clientes invitados.
 */
async function listProjectMembers(project: IProject): Promise<ProjectMemberSummary[]> {
  const manager = await User.findById(project.createdBy).select('email name');

  const rows = await ProjectMembership.find({ project: project._id }).populate<{
    user: { _id: unknown; email: string; name: string };
  }>('user', 'email name');

  const invited: ProjectMemberSummary[] = rows.map((row) => ({
    id: String(row._id),
    userId: String(row.user._id),
    email: row.user.email,
    name: row.user.name,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  }));

  if (!manager) return invited;

  return [
    {
      // El id de la obra y no el de una membresía: el gerente no tiene fila.
      id: String(project._id),
      userId: String(manager._id),
      email: manager.email,
      name: manager.name,
      role: 'gerente',
      createdAt: project.createdAt.toISOString(),
    },
    ...invited,
  ];
}

/**
 * Invita a alguien a la obra con un rol explícito —supervisor o cliente—.
 * Requiere `requireProjectAccess` + `requireCapability('project.invite')`.
 *
 * El rol viaja en el body y no se adivina: desde que el supervisor existe,
 * "invitar a la obra" dejó de significar una sola cosa.
 *
 * Si el email no tiene cuenta todavía, la crea sin contraseña y manda el mail
 * de activación que ya existe (`EmailService.sendAccountActivationEmail`) —
 * no hay flujo nuevo que inventar.
 */
export async function inviteProjectMember(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = inviteProjectMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { email, role } = parsed.data;

    const inviter = await User.findById(req.user.sub);
    if (inviter && email === inviter.email) {
      return res.status(400).json({ success: false, error: 'No podés invitarte a vos mismo' });
    }

    let user = await User.findOne({ email });
    // Sólo si esta invitación crea la cuenta: ver `activationDelivery`.
    let delivery: ReturnType<typeof activationDelivery> | undefined;

    if (user) {
      const alreadyMember = await ProjectMembership.exists({
        project: project._id,
        user: user._id,
      });
      // También 409 si ya está con otro rol: cambiar el rol de alguien es una
      // acción distinta de invitarlo, y hacerla por acá la volvería silenciosa.
      if (alreadyMember || String(project.createdBy) === String(user._id)) {
        return res
          .status(409)
          .json({ success: false, error: 'Esa persona ya tiene acceso a la obra' });
      }
    } else {
      const activationToken = randomToken();
      const name = email.split('@')[0];
      user = await User.create({
        email,
        name,
        role: 'user',
        email_verified: false,
        emailVerificationToken: activationToken,
        emailVerificationTokenExpires: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
      });
      await createPersonalOrganization(String(user._id), name);
      const emailSent = await EmailService.sendAccountActivationEmail(email, activationToken, name);
      delivery = activationDelivery(emailSent, activationToken);
    }

    const membership = await ProjectMembership.create({
      project: project._id,
      user: user._id,
      role,
      invitedBy: req.user.sub,
    });

    const member: ProjectMemberSummary = {
      id: String(membership._id),
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };

    return res.status(201).json({ success: true, data: { member, ...delivery } });
  } catch (error) {
    console.error('❌ [PROJECT] inviteProjectMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Cambia el rol de alguien en la obra. Requiere `requireProjectAccess` + el
 * `requireCapability(...)` que declara el router antes.
 *
 * Es una acción distinta de invitar y por eso tiene su propio endpoint: pasar
 * a alguien de cliente a contador le abre los gastos de la obra, y eso no
 * puede ser el efecto lateral de un formulario de invitación.
 */
export async function updateProjectMemberRole(req: Request, res: Response) {
  try {
    const parsed = invitableProjectRoleSchema.safeParse(req.body?.role);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Rol inválido', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const membership = await ProjectMembership.findOne({
      _id: req.params.membershipId,
      project: project._id,
    });

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Esa persona no está en la obra' });
    }

    membership.role = parsed.data;
    await membership.save();

    const user = await User.findById(membership.user).select('email name');

    const member: ProjectMemberSummary = {
      id: String(membership._id),
      userId: String(membership.user),
      email: user?.email ?? '',
      name: user?.name ?? '',
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };

    return res.json({ success: true, data: { member } });
  } catch (error) {
    console.error('❌ [PROJECT] updateProjectMemberRole:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Saca a alguien de la obra. Requiere `requireProjectAccess` + el
 * `requireCapability(...)` que declara el router antes.
 *
 * Borrado duro de la membresía, no baja lógica: una fila `active: false` que
 * el middleware tendría que recordar filtrar es exactamente la clase de
 * detalle que un día se olvida y deja entrar a alguien que ya no debería.
 * Nada referencia a la membresía, así que no hay trazabilidad que preservar —
 * lo que esa persona cargó queda con su `createdBy` intacto.
 *
 * Al gerente no se le puede revocar el acceso: sale de `Project.createdBy` y
 * no tiene fila, así que ni siquiera hay qué borrar.
 */
export async function removeProjectMember(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const membership = await ProjectMembership.findOne({
      _id: req.params.membershipId,
      project: project._id,
    });

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Esa persona no está en la obra' });
    }

    await ProjectMembership.findByIdAndDelete(membership._id);

    return res.json({ success: true, data: { membershipId: String(membership._id) } });
  } catch (error) {
    console.error('❌ [PROJECT] removeProjectMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
