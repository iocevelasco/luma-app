import type { Request, Response } from 'express';
import {
  inviteMemberSchema,
  updateOrganizationMemberSchema,
  updateOrganizationSchema,
  type CompanyStaffRole,
  type Organization as OrganizationDTO,
  type OrganizationMemberSummary,
} from '@luma/shared';
import { Organization, type IOrganization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import {
  createPersonalOrganization,
  findMyOrganizationId,
} from '../services/organization.service.js';
import { EmailService } from '../services/email.service.js';
import { activationDelivery } from '../utils/activation.js';
import { ACTIVATION_TOKEN_TTL_MS, randomToken } from './auth.controller.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toOrganizationDTO(org: IOrganization): OrganizationDTO {
  return {
    id: String(org._id),
    name: org.name,
    contactEmail: org.contactEmail,
    contactPhone: org.contactPhone,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export async function getMyOrganization(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const organizationId = await findMyOrganizationId(req.user.sub);
    const organization = organizationId ? await Organization.findById(organizationId) : null;
    if (!organization) {
      return res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    }

    return res.json({ success: true, data: { organization: toOrganizationDTO(organization) } });
  } catch (error) {
    console.error('❌ [ORG] getMyOrganization:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

export async function renameMyOrganization(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = updateOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const organizationId = await findMyOrganizationId(req.user.sub);
    // `''` borra el contacto: con `$set` de `undefined` Mongoose ignora el
    // campo y el valor viejo se queda, así que el borrado va por `$unset`.
    const { name, contactEmail, contactPhone } = parsed.data;
    const $set: Record<string, string> = {};
    const $unset: Record<string, 1> = {};
    if (name !== undefined) $set.name = name;
    if (contactEmail !== undefined) {
      if (contactEmail) $set.contactEmail = contactEmail;
      else $unset.contactEmail = 1;
    }
    if (contactPhone !== undefined) {
      if (contactPhone) $set.contactPhone = contactPhone;
      else $unset.contactPhone = 1;
    }

    const organization = organizationId
      ? await Organization.findByIdAndUpdate(
          organizationId,
          {
            ...(Object.keys($set).length > 0 && { $set }),
            ...(Object.keys($unset).length > 0 && { $unset }),
          },
          { new: true },
        )
      : null;

    if (!organization) {
      return res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    }

    return res.json({ success: true, data: { organization: toOrganizationDTO(organization) } });
  } catch (error) {
    console.error('❌ [ORG] renameMyOrganization:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Asistentes de Obra de mi Empresa (no incluye al dueño). */
export async function listMembers(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const organizationId = await findMyOrganizationId(req.user.sub);
    if (!organizationId) {
      return res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    }

    const memberRows = await OrganizationMember.find({
      organization: organizationId,
      role: 'member',
    }).populate<{
      user: { _id: unknown; email: string; name: string; email_verified: boolean };
    }>('user', 'email name email_verified');

    const members = memberRows.map((row) => toMemberSummary(row, row.user));

    return res.json({ success: true, data: { members } });
  } catch (error) {
    console.error('❌ [ORG] listMembers:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Suma a alguien del personal administrativo a mi Empresa, con su nombre y su
 * función (gerente, supervisor, contador). Pertenecer no da acceso a ninguna
 * obra: eso se invita obra por obra. Mismo patrón que `inviteProjectMember`
 * en `project.controller.ts`: si el email no tiene cuenta todavía, la crea sin
 * contraseña y manda el mail de activación que ya existe — no hay flujo nuevo
 * que inventar.
 *
 * El nombre sólo se usa al crear la cuenta. Si el email ya existe, la persona
 * ya eligió cómo se llama y quien la suma no tiene por qué pisárselo.
 */
export async function inviteMember(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const organizationId = await findMyOrganizationId(req.user.sub);
    if (!organizationId) {
      return res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    }

    const { email, name, staffRole, phone } = parsed.data;

    const inviter = await User.findById(req.user.sub);
    if (inviter && email === inviter.email) {
      return res.status(400).json({ success: false, error: 'No podés invitarte a vos mismo' });
    }

    let user = await User.findOne({ email });
    // Sólo cuando esta invitación crea la cuenta: quien ya existía no recibe
    // mail de activación, así que no hay nada que contar.
    let delivery: ReturnType<typeof activationDelivery> | undefined;

    if (user) {
      const alreadyMember = await OrganizationMember.exists({
        organization: organizationId,
        user: user._id,
      });
      if (alreadyMember) {
        return res
          .status(409)
          .json({ success: false, error: 'Esa persona ya forma parte de tu equipo' });
      }
    } else {
      const activationToken = randomToken();
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

    const memberRow = await OrganizationMember.create({
      organization: organizationId,
      user: user._id,
      role: 'member',
      staffRole,
      ...(phone ? { phone } : {}),
    });

    return res
      .status(201)
      .json({ success: true, data: { member: toMemberSummary(memberRow, user), ...delivery } });
  } catch (error) {
    console.error('❌ [ORG] inviteMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Un integrante de MI Empresa — nunca el dueño ni alguien de otra. */
async function findTeamMember(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  const organizationId = await findMyOrganizationId(req.user.sub);
  if (!organizationId) {
    res.status(404).json({ success: false, error: 'No tenés una empresa todavía' });
    return null;
  }
  const row = await OrganizationMember.findOne({
    _id: req.params.memberId,
    organization: organizationId,
    role: 'member',
  });
  if (!row) {
    res.status(404).json({ success: false, error: 'No encontramos a esa persona en tu equipo' });
    return null;
  }
  return { row, organizationId };
}

function toMemberSummary(
  row: { _id: unknown; createdAt: Date; staffRole?: CompanyStaffRole; phone?: string },
  user: { _id: unknown; email: string; name: string; email_verified: boolean },
): OrganizationMemberSummary {
  return {
    id: String(row._id),
    userId: String(user._id),
    email: user.email,
    name: user.name,
    role: 'member',
    ...(row.staffRole ? { staffRole: row.staffRole } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    pending: !user.email_verified,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Corrige cómo se llama un integrante y qué función tiene. El email es su identidad y no se toca. */
export async function updateMember(req: Request, res: Response) {
  try {
    const parsed = updateOrganizationMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const found = await findTeamMember(req, res);
    if (!found) return;

    // Sin `staffRole` ni `phone` en el body no se tocan: corregir un nombre no
    // borra la función ni el teléfono. Un `phone` vacío sí lo borra, igual que
    // `contactPhone` de la Empresa.
    let dirty = false;
    if (parsed.data.staffRole && parsed.data.staffRole !== found.row.staffRole) {
      found.row.staffRole = parsed.data.staffRole;
      dirty = true;
    }
    if (parsed.data.phone !== undefined && parsed.data.phone !== (found.row.phone ?? '')) {
      found.row.phone = parsed.data.phone || undefined;
      dirty = true;
    }
    if (dirty) await found.row.save();

    const user = await User.findByIdAndUpdate(
      found.row.user,
      { name: parsed.data.name },
      { new: true },
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'No encontramos a esa persona' });
    }

    return res.json({ success: true, data: { member: toMemberSummary(found.row, user) } });
  } catch (error) {
    console.error('❌ [ORG] updateMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Saca a alguien del equipo de la Empresa. No toca su cuenta —puede ser
 * dueño de la suya o trabajar con otras Empresas—: borra el vínculo y los
 * accesos que tenía a las obras de ESTA Empresa, que es lo que "baja" quiere
 * decir. Las obras y todo lo que cargó quedan como están.
 */
export async function removeMember(req: Request, res: Response) {
  try {
    const found = await findTeamMember(req, res);
    if (!found) return;

    const projectIds = await Project.find({ organization: found.organizationId }).distinct('_id');
    await ProjectMembership.deleteMany({
      user: found.row.user,
      project: { $in: projectIds },
      role: { $ne: 'cliente' },
    });
    await found.row.deleteOne();

    return res.json({ success: true, data: { memberId: String(found.row._id) } });
  } catch (error) {
    console.error('❌ [ORG] removeMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Reenvía el mail de activación a quien todavía no eligió su contraseña. */
export async function resendMemberInvitation(req: Request, res: Response) {
  try {
    const found = await findTeamMember(req, res);
    if (!found) return;

    const user = await User.findById(found.row.user);
    if (!user) {
      return res.status(404).json({ success: false, error: 'No encontramos a esa persona' });
    }
    if (user.email_verified) {
      return res
        .status(409)
        .json({ success: false, error: 'Esa persona ya activó su cuenta' });
    }

    const activationToken = randomToken();
    user.emailVerificationToken = activationToken;
    user.emailVerificationTokenExpires = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);
    await user.save();
    const emailSent = await EmailService.sendAccountActivationEmail(
      user.email,
      activationToken,
      user.name,
    );

    return res.json({
      success: true,
      data: {
        member: toMemberSummary(found.row, user),
        ...activationDelivery(emailSent, activationToken),
      },
    });
  } catch (error) {
    console.error('❌ [ORG] resendMemberInvitation:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
