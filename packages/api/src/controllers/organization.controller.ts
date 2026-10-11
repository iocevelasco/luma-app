import type { Request, Response } from 'express';
import {
  inviteMemberSchema,
  renameOrganizationSchema,
  type Organization as OrganizationDTO,
  type OrganizationMemberSummary,
} from '@luma/shared';
import { Organization, type IOrganization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { User } from '../models/User.js';
import { createPersonalOrganization, findMyOrganizationId } from '../services/organization.service.js';
import { EmailService } from '../services/email.service.js';
import { ACTIVATION_TOKEN_TTL_MS, randomToken } from './auth.controller.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toOrganizationDTO(org: IOrganization): OrganizationDTO {
  return {
    id: String(org._id),
    name: org.name,
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
    const parsed = renameOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const organizationId = await findMyOrganizationId(req.user.sub);
    const organization = organizationId
      ? await Organization.findByIdAndUpdate(
          organizationId,
          { name: parsed.data.name },
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
    }).populate<{ user: { _id: unknown; email: string; name: string } }>('user', 'email name');

    const members: OrganizationMemberSummary[] = memberRows.map((row) => ({
      id: String(row._id),
      userId: String(row.user._id),
      email: row.user.email,
      name: row.user.name,
      role: 'member',
      createdAt: row.createdAt.toISOString(),
    }));

    return res.json({ success: true, data: { members } });
  } catch (error) {
    console.error('❌ [ORG] listMembers:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Invita a un Asistente de Obra a mi Empresa — acceso operativo a todas mis
 * obras, nunca a presupuesto ni a gestionar gente. Mismo patrón que
 * `inviteClient` en `project.controller.ts`: si el email no tiene cuenta
 * todavía, la crea sin contraseña y manda el mail de activación que ya
 * existe — no hay flujo nuevo que inventar.
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

    const { email } = parsed.data;

    const inviter = await User.findById(req.user.sub);
    if (inviter && email === inviter.email) {
      return res.status(400).json({ success: false, error: 'No podés invitarte a vos mismo' });
    }

    let user = await User.findOne({ email });

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

    const memberRow = await OrganizationMember.create({
      organization: organizationId,
      user: user._id,
      role: 'member',
    });

    const member: OrganizationMemberSummary = {
      id: String(memberRow._id),
      userId: String(user._id),
      email: user.email,
      name: user.name,
      role: 'member',
      createdAt: memberRow.createdAt.toISOString(),
    };

    return res.status(201).json({ success: true, data: { member } });
  } catch (error) {
    console.error('❌ [ORG] inviteMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
