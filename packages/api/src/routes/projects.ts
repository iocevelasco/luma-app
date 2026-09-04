import { Router } from 'express';
import mongoose from 'mongoose';
import {
  createProjectSchema,
  updateProjectSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMemberModel } from '../models/ProjectMember.js';
import { UserModel } from '../models/User.js';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import { audit } from '../services/audit.service.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

export const projectsRouter = Router();

projectsRouter.use(isAuthenticated);

/** Proyectos donde la persona participa, con su rol en cada uno. */
projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await AuthService.listProjects(req.user!.sub);
    res.json({ success: true, data: projects });
  }),
);

/**
 * Crear proyecto. Quien lo crea queda como `executor` en el mismo movimiento:
 * un proyecto sin dueño sería un proyecto al que nadie puede entrar.
 */
projectsRouter.post(
  '/',
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user!.sub);
    const project = await ProjectModel.create({ ...req.body, owner_id: userId });

    await ProjectMemberModel.create({
      project_id: project._id,
      user_id: userId,
      role: 'executor',
      status: 'active',
      joined_at: new Date(),
    });

    await audit({
      projectId: project._id.toString(),
      userId: req.user!.sub,
      action: 'project.create',
      entity: 'Project',
      entityId: project._id.toString(),
      summary: `Se creó el proyecto "${project.name}"`,
    });

    res.status(201).json({ success: true, data: { ...project.toObject(), id: project._id } });
  }),
);

projectsRouter.get(
  '/current',
  withProject,
  asyncHandler(async (req, res) => {
    const project = await ProjectModel.findById(req.projectId).lean();
    if (!project) throw notFound('Proyecto no encontrado');
    res.json({
      success: true,
      data: { ...project, id: project._id.toString(), my_role: req.projectRole },
    });
  }),
);

projectsRouter.patch(
  '/current',
  withProject,
  requirePermission('members.manage'),
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await ProjectModel.findByIdAndUpdate(req.projectId, req.body, { new: true });
    if (!project) throw notFound('Proyecto no encontrado');
    await audit({
      projectId: req.projectId!,
      userId: req.user!.sub,
      action: 'project.update',
      entity: 'Project',
      entityId: req.projectId!,
      summary: `Se actualizó la configuración del proyecto`,
    });
    res.json({ success: true, data: { ...project.toObject(), id: project._id } });
  }),
);

// ─── Equipo ──────────────────────────────────────────────────────────────────

projectsRouter.get(
  '/current/members',
  withProject,
  asyncHandler(async (req, res) => {
    const members = await ProjectMemberModel.find({
      project_id: new mongoose.Types.ObjectId(req.projectId!),
      status: { $ne: 'removed' },
    }).lean();

    const users = await UserModel.find({ _id: { $in: members.map((m) => m.user_id) } })
      .select({ email: 1, name: 1, picture: 1 })
      .lean();
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    res.json({
      success: true,
      data: members.map((m) => {
        const u = userById.get(m.user_id.toString());
        return {
          id: m._id.toString(),
          project_id: m.project_id.toString(),
          user_id: m.user_id.toString(),
          role: m.role,
          status: m.status,
          joined_at: m.joined_at,
          user: u
            ? { id: u._id.toString(), email: u.email, name: u.name, picture: u.picture }
            : undefined,
        };
      }),
    });
  }),
);

/**
 * Invitar a alguien al proyecto.
 *
 * Si el email ya tiene cuenta, se lo suma directo. Si no, se crea la cuenta sin
 * contraseña y se le manda un link de activación: pedirle a un cliente que
 * primero se registre y después acepte una invitación pierde a la mitad en el
 * camino.
 */
projectsRouter.post(
  '/current/members',
  withProject,
  requirePermission('members.manage'),
  validateBody(inviteMemberSchema),
  asyncHandler(async (req, res) => {
    const { email, name, role } = req.body;
    const projectOid = new mongoose.Types.ObjectId(req.projectId!);

    const project = await ProjectModel.findById(projectOid).lean();
    if (!project) throw notFound('Proyecto no encontrado');

    const inviter = await UserModel.findById(req.user!.sub).select({ name: 1, email: 1 }).lean();
    const inviterName = inviter?.name ?? inviter?.email ?? 'Alguien';

    let user = await UserModel.findOne({ email });
    let isNew = false;

    if (!user) {
      const { raw, hashed } = AuthService.generateToken();
      user = await UserModel.create({
        email,
        name,
        enabled: true,
        invitationToken: hashed,
        invitationTokenExpires: AuthService.tokenExpiry('invite'),
      });
      isNew = true;
      await EmailService.sendInvitation(email, raw, project.name, inviterName);
    }

    const existing = await ProjectMemberModel.findOne({
      project_id: projectOid,
      user_id: user._id,
    });

    if (existing && existing.status === 'active') {
      throw conflict('Esa persona ya está en el proyecto', 'ALREADY_MEMBER');
    }

    const membership = existing
      ? await ProjectMemberModel.findByIdAndUpdate(
          existing._id,
          { role, status: 'active', joined_at: new Date() },
          { new: true },
        )
      : await ProjectMemberModel.create({
          project_id: projectOid,
          user_id: user._id,
          role,
          // Se activa de una: el "invited" intermedio agregaba un paso de
          // aceptación que nadie pedía y dejaba proyectos con gente en limbo.
          status: 'active',
          invited_by: new mongoose.Types.ObjectId(req.user!.sub),
          joined_at: new Date(),
        });

    if (!isNew) await EmailService.sendProjectAdded(email, project.name, inviterName);

    await audit({
      projectId: req.projectId!,
      userId: req.user!.sub,
      action: 'project.invite_member',
      entity: 'ProjectMember',
      entityId: membership!._id.toString(),
      summary: `Se sumó a ${email} como ${role}`,
    });

    res.status(201).json({
      success: true,
      data: { id: membership!._id.toString(), role, email, invited: isNew },
    });
  }),
);

projectsRouter.patch(
  '/current/members/:memberId',
  withProject,
  requirePermission('members.manage'),
  validateBody(updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    const membership = await ProjectMemberModel.findOne({
      _id: req.params.memberId,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (!membership) throw notFound('Integrante no encontrado');

    // El dueño no puede dejar de ser ejecutante: si pudiera, un proyecto
    // quedaría sin nadie que administre usuarios.
    const project = await ProjectModel.findById(req.projectId!).lean();
    if (project?.owner_id.toString() === membership.user_id.toString() && req.body.role !== 'executor') {
      throw badRequest('El dueño del proyecto no puede cambiar de rol', 'OWNER_ROLE_LOCKED');
    }

    membership.role = req.body.role;
    await membership.save();

    await audit({
      projectId: req.projectId!,
      userId: req.user!.sub,
      action: 'project.update_member_role',
      entity: 'ProjectMember',
      entityId: membership._id.toString(),
      summary: `Cambio de rol a ${req.body.role}`,
    });

    res.json({ success: true, data: { id: membership._id.toString(), role: membership.role } });
  }),
);

projectsRouter.delete(
  '/current/members/:memberId',
  withProject,
  requirePermission('members.manage'),
  asyncHandler(async (req, res) => {
    const membership = await ProjectMemberModel.findOne({
      _id: req.params.memberId,
      project_id: new mongoose.Types.ObjectId(req.projectId!),
    });
    if (!membership) throw notFound('Integrante no encontrado');

    const project = await ProjectModel.findById(req.projectId!).lean();
    if (project?.owner_id.toString() === membership.user_id.toString()) {
      throw badRequest('No se puede sacar al dueño del proyecto', 'OWNER_LOCKED');
    }

    // Baja lógica: el historial de imprevistos referencia al usuario, y borrar
    // la fila dejaría decisiones firmadas por un id que ya no resuelve.
    membership.status = 'removed';
    await membership.save();

    res.json({ success: true, data: { message: 'Se quitó del proyecto' } });
  }),
);
