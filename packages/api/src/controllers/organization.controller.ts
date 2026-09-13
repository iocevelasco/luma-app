import type { Request, Response } from 'express';
import { renameOrganizationSchema, type Organization as OrganizationDTO } from '@luma/shared';
import { Organization, type IOrganization } from '../models/Organization.js';
import { findMyOrganizationId } from '../services/organization.service.js';

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
