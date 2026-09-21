import type { Request, Response } from 'express';
import {
  createProjectSchema,
  inviteClientSchema,
  type Project as ProjectDTO,
  type ProjectClientSummary,
} from '@luma/shared';
import { User } from '../models/User.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectClient } from '../models/ProjectClient.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { createPersonalOrganization, findMyOrganizationId } from '../services/organization.service.js';
import { EmailService } from '../services/email.service.js';
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
    budgetType: project.budgetType,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
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
    const clientProjectIds = await ProjectClient.find({ user: userId }).distinct('project');
    const memberOrgIds = await OrganizationMember.find({ user: userId, role: 'member' }).distinct(
      'organization',
    );

    const projects = await Project.find({
      $or: [
        { createdBy: userId },
        { _id: { $in: clientProjectIds } },
        { organization: { $in: memberOrgIds } },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({ success: true, data: { projects: projects.map(toProjectDTO) } });
  } catch (error) {
    console.error('❌ [PROJECT] listProjects:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` antes: usa `req.project`/`req.isProjectOwner`. */
export async function getProject(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    const clientRows = await ProjectClient.find({ project: project._id }).populate<{
      user: { _id: unknown; email: string; name: string };
    }>('user', 'email name');

    const clients: ProjectClientSummary[] = clientRows.map((row) => ({
      id: String(row._id),
      userId: String(row.user._id),
      email: row.user.email,
      name: row.user.name,
      createdAt: row.createdAt.toISOString(),
    }));

    return res.json({
      success: true,
      data: {
        project: {
          ...toProjectDTO(project),
          isOwner: Boolean(req.isProjectOwner),
          isEditor: Boolean(req.isProjectEditor),
        },
        clients,
      },
    });
  } catch (error) {
    console.error('❌ [PROJECT] getProject:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Invita a quien paga la obra. Requiere `requireProjectAccess` +
 * `requireProjectOwner` antes. Si el email no tiene cuenta todavía, la crea
 * sin contraseña y manda el mail de activación que ya existe
 * (`EmailService.sendAccountActivationEmail`) — no hay flujo nuevo que inventar.
 */
export async function inviteClient(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = inviteClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { email } = parsed.data;

    const inviter = await User.findById(req.user.sub);
    if (inviter && email === inviter.email) {
      return res.status(400).json({ success: false, error: 'No podés invitarte a vos mismo' });
    }

    let user = await User.findOne({ email });

    if (user) {
      const alreadyClient = await ProjectClient.exists({ project: project._id, user: user._id });
      if (alreadyClient) {
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
      await EmailService.sendAccountActivationEmail(email, activationToken, name);
    }

    const clientRow = await ProjectClient.create({
      project: project._id,
      user: user._id,
      invitedBy: req.user.sub,
    });

    const client: ProjectClientSummary = {
      id: String(clientRow._id),
      userId: String(user._id),
      email: user.email,
      name: user.name,
      createdAt: clientRow.createdAt.toISOString(),
    };

    return res.status(201).json({ success: true, data: { client } });
  } catch (error) {
    console.error('❌ [PROJECT] inviteClient:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
