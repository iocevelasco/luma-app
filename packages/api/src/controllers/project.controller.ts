import type { NextFunction, Request, Response } from 'express';
import {
  capabilityToManageMember,
  countsTowardManagerLimit,
  createProjectSchema,
  invitableProjectRoleSchema,
  inviteProjectMemberSchema,
  updateProjectSchema,
  type ActivationDelivery,
  type Capability,
  type Project as ProjectDTO,
  type ProjectMemberSummary,
  type ProjectRole,
} from '@luma/shared';
import { User } from '../models/User.js';
import { projectCapabilitiesFor } from '../middleware/project.middleware.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import {
  assertManagerSlotFree,
  confirmManagerSlot,
} from '../services/project-managers.service.js';
import { createPersonalOrganization, findMyOrganizationId } from '../services/organization.service.js';
import { removedProjectsForMember } from '../services/project-deletion.service.js';
import { decideProjectCreation, statesFor } from '../services/subscription.service.js';
import { syncStripeExtras } from '../services/stripe.service.js';
import { AppError, forbidden, isAppError } from '../utils/errors.js';
import { EmailService } from '../services/email.service.js';
import {
  isLinkedToAnotherInviter,
  LINK_HELD_BY_ANOTHER_MESSAGE,
  recordActivationDelivery,
} from '../services/activation.service.js';
import { activationDelivery } from '../utils/activation.js';
import { ACTIVATION_TOKEN_TTL_MS, randomToken } from './auth.controller.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

const MANAGER_WRITE_MESSAGE =
  'Sólo quien creó la obra puede cambiarle el rol o sacar a otro gerente.';

export function toProjectDTO(project: IProject): ProjectDTO {
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
    purchasesVisibleToClient: Boolean(project.purchasesVisibleToClient),
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

/** Lo que se le dice a quien choca con un límite de la suscripción al crear una obra. */
const CREATE_PROJECT_BLOCKED: Record<'SUBSCRIPTION_REQUIRED' | 'PAID_PLAN_REQUIRED', string> = {
  SUBSCRIPTION_REQUIRED: 'Tu suscripción venció. Renová el plan para crear obras.',
  PAID_PLAN_REQUIRED:
    'En el mes gratis podés tener hasta 3 obras activas. Activá el plan para crear la cuarta.',
};

export async function createProject(req: Request, res: Response, next: NextFunction) {
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

    // Límite de la suscripción: 3 activas en la prueba, vencida no crea nada.
    // Si es su primera obra y nunca empezó la prueba (un invitado), se la
    // arranca acá adentro.
    const decision = await decideProjectCreation(organizationId, req.user.sub);
    if (!decision.allowed) {
      throw new AppError(decision.code, CREATE_PROJECT_BLOCKED[decision.code]);
    }

    const project = await Project.create({
      ...parsed.data,
      organization: organizationId,
      createdBy: req.user.sub,
    });

    // Con tarjeta, la extra se le suma en Stripe (que prorratea el resto del
    // mes). Si Stripe falla la obra ya existe: se loguea y no se voltea la
    // creación — la cantidad se corrige en la próxima sincronización.
    if (decision.isExtra) {
      syncStripeExtras(organizationId).catch((error) =>
        console.error('❌ [STRIPE] syncStripeExtras:', error),
      );
    }

    return res.status(201).json({ success: true, data: { project: toProjectDTO(project) } });
  } catch (error) {
    if (isAppError(error)) return next(error);
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

    // Cada obra puede ser de una Empresa distinta (las que me invitaron son
    // de otros): el estado de todas en dos consultas.
    const subscriptions = await statesFor(projects.map((p) => p.organization));

    return res.json({
      success: true,
      data: {
        removedProjects: await removedProjectsForMember(userId),
        projects: projects.map((project) => {
          // El dueño no tiene fila: sale de `createdBy` y gana sobre cualquier
          // membresía (mismo criterio que `requireProjectAccess`). Otro gerente
          // sí la tiene, con `role: 'gerente'`.
          const role: ProjectRole =
            String(project.createdBy) === userId
              ? 'gerente'
              : (roleByProject.get(String(project._id)) as ProjectRole);
          const readOnly = subscriptions.get(String(project.organization))?.canWrite === false;
          return {
            ...toProjectDTO(project),
            role,
            capabilities: projectCapabilitiesFor(project, role, userId, readOnly),
            readOnly,
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
          capabilities: req.projectCapabilities ?? [],
          readOnly: req.projectReadOnly === true,
        },
        members: await listProjectMembers(project, (capability) => req.can?.(capability) === true),
      },
    });
  } catch (error) {
    console.error('❌ [PROJECT] getProject:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

type MemberUser = {
  _id: unknown;
  email: string;
  name: string;
  email_verified?: boolean;
  account_status?: string;
};

/** Qué ve la persona en la fila de quien todavía no entró o ya no puede entrar. */
function accountState(user: MemberUser, hasPassword: boolean) {
  return {
    // "Ya activó" es tener contraseña, no sólo haber verificado el correo.
    pending: !user.email_verified || !hasPassword,
    inactive: user.account_status === 'inactive',
  };
}

/**
 * El equipo de la obra: quien la creó —que no tiene fila de membresía, sale de
 * `createdBy`— seguido de los gerentes, supervisores, contadores y clientes
 * invitados.
 *
 * `can` es la grilla de quien pide la lista: decide si cada fila se puede
 * tocar (la de otro gerente pide `project.manager.write`). Se resuelve acá y
 * no en la UI, que no sabe quién creó la obra.
 */
async function listProjectMembers(
  project: IProject,
  can: (capability: Capability) => boolean,
): Promise<ProjectMemberSummary[]> {
  const manager = await User.findById(project.createdBy).select(
    'email name email_verified account_status',
  );

  const rows = await ProjectMembership.find({ project: project._id }).populate<{
    user: MemberUser;
  }>('user', 'email name email_verified account_status');

  // Quién tiene contraseña, en una sola consulta para toda la lista.
  const withPassword = new Set(
    (
      await User.find({
        _id: { $in: [project.createdBy, ...rows.map((row) => row.user._id)] },
        password: { $exists: true },
      }).select('_id')
    ).map((found) => String(found._id)),
  );

  const invited: ProjectMemberSummary[] = rows.map((row) => ({
    id: String(row._id),
    userId: String(row.user._id),
    email: row.user.email,
    name: row.user.name,
    role: row.role,
    manageable: can(capabilityToManageMember(row.role)),
    ...accountState(row.user, withPassword.has(String(row.user._id))),
    createdAt: row.createdAt.toISOString(),
  }));

  if (!manager) return invited;

  return [
    {
      // El id de la obra y no el de una membresía: el dueño no tiene fila, y
      // por eso no hay nada que cambiarle ni que sacar.
      id: String(project._id),
      userId: String(manager._id),
      email: manager.email,
      name: manager.name,
      role: 'gerente',
      manageable: false,
      ...accountState(manager, withPassword.has(String(manager._id))),
      createdAt: project.createdAt.toISOString(),
    },
    ...invited,
  ];
}

/**
 * Invita a alguien a la obra con un rol explícito: gerente, supervisor,
 * contador o cliente. Requiere `requireProjectAccess` +
 * `requireCapability('project.invite')`.
 *
 * El rol viaja en el body y no se adivina: desde que el supervisor existe,
 * "invitar a la obra" dejó de significar una sola cosa.
 *
 * Si el email no tiene cuenta todavía, la crea sin contraseña y manda el mail
 * de activación que ya existe (`EmailService.sendAccountActivationEmail`) —
 * no hay flujo nuevo que inventar.
 *
 * **Un gerente más** cuenta para el tope (`MAX_PROJECT_MANAGERS`): se chequea
 * antes de crear nada y se vuelve a chequear al guardar, porque dos
 * invitaciones simultáneas pasan las dos el primer chequeo. Por eso el mail de
 * activación sale **después**: no se manda a quien termina sin lugar.
 */
export async function inviteProjectMember(req: Request, res: Response, next: NextFunction) {
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
    let delivery: ActivationDelivery | undefined;
    // Quien ya tenía cuenta no recibe activación: recibe un aviso de la obra.
    let notifyExistingUser = false;
    // La cuenta se crea antes de guardar la membresía, pero el mail sale después.
    let activation: { token: string; name: string } | null = null;

    if (user) {
      // Ver `isLinkedToAnotherInviter`: la cuenta puede estar en manos de quien
      // invitó antes, y sumarla acá le abriría esta obra a esa persona.
      if (isLinkedToAnotherInviter(user, req.user.sub)) {
        return res.status(409).json({ success: false, error: LINK_HELD_BY_ANOTHER_MESSAGE });
      }
      // Una cuenta dada de baja no puede entrar: invitarla sólo ocuparía un
      // lugar (y, siendo gerente, uno de los cinco).
      // 400 y no 409: no choca con nada de la obra, y la pantalla de la Empresa
      // lee un 409 como "ya tenía acceso".
      if (user.account_status === 'inactive') {
        return res.status(400).json({
          success: false,
          error: 'Esa cuenta está dada de baja y no puede sumarse a la obra.',
        });
      }
      const existing = await ProjectMembership.findOne({
        project: project._id,
        user: user._id,
      }).select('role');
      // 409 también si ya está con otro rol: cambiar el rol de alguien es una
      // acción distinta de invitarlo, y hacerla por acá la volvería silenciosa.
      if (existing || String(project.createdBy) === String(user._id)) {
        const current = existing?.role ?? 'gerente';
        return res.status(409).json({
          success: false,
          error:
            current === role
              ? `Esa persona ya es ${role} de esta obra.`
              : `Esa persona ya está en la obra como ${current}. Cambiale el rol desde la lista.`,
        });
      }
      notifyExistingUser = true;
    }

    // Antes de crear la cuenta: no se deja una cuenta nueva colgada por un tope.
    if (countsTowardManagerLimit(role)) await assertManagerSlotFree(project);

    if (!user) {
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
      activation = { token: activationToken, name };
    }

    const membership = await ProjectMembership.create({
      project: project._id,
      user: user._id,
      role,
      invitedBy: req.user.sub,
    });

    if (countsTowardManagerLimit(role)) {
      await confirmManagerSlot(project, () => ProjectMembership.findByIdAndDelete(membership._id));
    }

    if (activation) {
      const emailSent = await EmailService.sendAccountActivationEmail(
        email,
        activation.token,
        activation.name,
        { inviterName: inviter?.name, projectName: project.name, role },
      );
      await recordActivationDelivery(user._id, emailSent, req.user.sub);
      delivery = activationDelivery(emailSent, activation.token);
    }

    if (notifyExistingUser) {
      // Sin `await`: el mail no demora ni voltea la invitación.
      void EmailService.sendProjectInvitation({
        to: user.email,
        name: user.name,
        inviterName: inviter?.name,
        projectName: project.name,
        projectId: String(project._id),
        role,
      });
    }

    // Una cuenta que esta invitación acaba de crear no tiene contraseña todavía.
    const hasPassword =
      !activation && Boolean(await User.exists({ _id: user._id, password: { $exists: true } }));

    const member: ProjectMemberSummary = {
      id: String(membership._id),
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: membership.role,
      manageable: req.can?.(capabilityToManageMember(membership.role)) === true,
      ...accountState(user, hasPassword),
      createdAt: membership.createdAt.toISOString(),
    };

    return res.status(201).json({ success: true, data: { member, ...delivery } });
  } catch (error) {
    if (isAppError(error)) return next(error);
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
 *
 * Hacer gerente a alguien cuenta para el tope, igual que invitarlo: es la otra
 * puerta al sexto gerente. Bajarle el rol a un gerente es de quien creó la obra
 * (`project.manager.write`): si cualquier gerente pudiera, dos podrían sacarse
 * entre sí.
 */
export async function updateProjectMemberRole(req: Request, res: Response, next: NextFunction) {
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

    const previousRole = membership.role;
    if (!req.can?.(capabilityToManageMember(previousRole))) throw forbidden(MANAGER_WRITE_MESSAGE);

    if (parsed.data !== previousRole) {
      const becomesManager =
        countsTowardManagerLimit(parsed.data) && !countsTowardManagerLimit(previousRole);
      if (becomesManager) await assertManagerSlotFree(project);

      membership.role = parsed.data;
      await membership.save();

      if (becomesManager) {
        await confirmManagerSlot(project, async () => {
          membership.role = previousRole;
          await membership.save();
        });
      }
    }

    const user = await User.findById(membership.user).select(
      'email name email_verified account_status',
    );
    const hasPassword = Boolean(
      await User.exists({ _id: membership.user, password: { $exists: true } }),
    );

    const member: ProjectMemberSummary = {
      id: String(membership._id),
      userId: String(membership.user),
      email: user?.email ?? '',
      name: user?.name ?? '',
      role: membership.role,
      manageable: req.can?.(capabilityToManageMember(membership.role)) === true,
      ...(user ? accountState(user, hasPassword) : { pending: false, inactive: false }),
      createdAt: membership.createdAt.toISOString(),
    };

    return res.json({ success: true, data: { member } });
  } catch (error) {
    if (isAppError(error)) return next(error);
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
 * A quien creó la obra no se le puede revocar el acceso: sale de
 * `Project.createdBy` y no tiene fila, así que ni siquiera hay qué borrar. A
 * otro gerente sólo lo saca quien la creó (`project.manager.write`).
 */
export async function removeProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    const project = req.project as IProject;
    const membership = await ProjectMembership.findOne({
      _id: req.params.membershipId,
      project: project._id,
    });

    if (!membership) {
      return res.status(404).json({ success: false, error: 'Esa persona no está en la obra' });
    }

    if (!req.can?.(capabilityToManageMember(membership.role))) throw forbidden(MANAGER_WRITE_MESSAGE);

    await ProjectMembership.findByIdAndDelete(membership._id);

    return res.json({ success: true, data: { membershipId: String(membership._id) } });
  } catch (error) {
    if (isAppError(error)) return next(error);
    console.error('❌ [PROJECT] removeProjectMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
