import type { Request, Response } from 'express';
import {
  createProviderEngagementSchema,
  updateProviderEngagementSchema,
  type ProviderEngagement as ProviderEngagementDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { Provider } from '../models/Provider.js';
import {
  ProviderEngagement,
  type IProviderEngagement,
} from '../models/ProviderEngagement.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toEngagementDTO(engagement: IProviderEngagement): ProviderEngagementDTO {
  return {
    id: String(engagement._id),
    projectId: String(engagement.project),
    providerId: String(engagement.provider),
    status: engagement.status,
    quotedAmount: engagement.quotedAmount,
    advanceAmount: engagement.advanceAmount,
    estimatedStartDate: engagement.estimatedStartDate,
    requirements: engagement.requirements.map((requirement) => ({
      id: String(requirement._id),
      type: requirement.type,
      detail: requirement.detail,
      activityId: requirement.activity ? String(requirement.activity) : undefined,
      met: requirement.met,
    })),
    notes: engagement.notes,
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
  };
}

/**
 * El proveedor tiene que ser visible desde ESTA obra: de la libreta de la
 * Empresa o propio de esta obra. Mismo criterio que `provider.controller.ts`.
 */
async function findProviderInScope(project: IProject, providerId: string) {
  return Provider.findOne({
    _id: providerId,
    organization: project.organization,
    $or: [{ scope: { $ne: 'project' } }, { project: project._id }],
  });
}

/**
 * Las actividades referidas por un requisito `actividad_previa` tienen que
 * ser de esta obra — si no, un `activityId` a mano dejaría el requisito
 * apuntando al cronograma de otra obra.
 */
async function activitiesBelongToProject(
  project: IProject,
  requirements: { activityId?: string }[],
): Promise<boolean> {
  const ids = requirements
    .map((requirement) => requirement.activityId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return true;

  const found = await Activity.countDocuments({ _id: { $in: ids }, project: project._id });
  return found === new Set(ids).size;
}

/** `activityId` del DTO → ref `activity` del documento. */
function mapRequirements(
  requirements: { type: string; detail?: string; activityId?: string; met: boolean }[],
) {
  return requirements.map((requirement) => ({
    type: requirement.type,
    detail: requirement.detail,
    activity: requirement.activityId ?? null,
    met: requirement.met,
  }));
}

/** Requiere `requireProjectAccess` + `requireProviderRead` antes. */
export async function listProviderEngagements(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const provider = await findProviderInScope(project, String(req.params.providerId));
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const engagements = await ProviderEngagement.find({
      project: project._id,
      provider: provider._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: { engagements: engagements.map(toEngagementDTO) },
    });
  } catch (error) {
    console.error('❌ [ENGAGEMENT] listProviderEngagements:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes: la
 * contratación es plata, y el documento funcional deja la parte comercial en
 * manos de quien gestiona la obra, no del Asistente.
 */
export async function createProviderEngagement(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createProviderEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const provider = await findProviderInScope(project, String(req.params.providerId));
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    if (!(await activitiesBelongToProject(project, parsed.data.requirements))) {
      return res
        .status(400)
        .json({ success: false, error: 'Un requisito apunta a una actividad de otra obra' });
    }

    const engagement = await ProviderEngagement.create({
      ...parsed.data,
      requirements: mapRequirements(parsed.data.requirements),
      project: project._id,
      provider: provider._id,
      createdBy: req.user.sub,
    });

    return res
      .status(201)
      .json({ success: true, data: { engagement: toEngagementDTO(engagement) } });
  } catch (error) {
    console.error('❌ [ENGAGEMENT] createProviderEngagement:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Valida el
 * adelanto contra lo cotizado usando también lo que ya estaba guardado: si el
 * update trae sólo el adelanto, el tope sigue siendo la cotización vigente.
 */
export async function updateProviderEngagement(req: Request, res: Response) {
  try {
    const parsed = updateProviderEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const engagement = await ProviderEngagement.findOne({
      _id: req.params.engagementId,
      project: project._id,
      provider: req.params.providerId,
    });
    if (!engagement) {
      return res.status(404).json({ success: false, error: 'Contratación no encontrada' });
    }

    const quoted = parsed.data.quotedAmount ?? engagement.quotedAmount;
    const advance = parsed.data.advanceAmount ?? engagement.advanceAmount;
    if (quoted !== undefined && advance !== undefined && advance > quoted) {
      return res
        .status(400)
        .json({ success: false, error: 'El adelanto no puede superar lo cotizado' });
    }

    if (parsed.data.requirements && !(await activitiesBelongToProject(project, parsed.data.requirements))) {
      return res
        .status(400)
        .json({ success: false, error: 'Un requisito apunta a una actividad de otra obra' });
    }

    const { requirements, ...rest } = parsed.data;
    engagement.set(rest);
    if (requirements) {
      engagement.set('requirements', mapRequirements(requirements));
    }
    await engagement.save();

    return res.json({ success: true, data: { engagement: toEngagementDTO(engagement) } });
  } catch (error) {
    console.error('❌ [ENGAGEMENT] updateProviderEngagement:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes.
 *
 * Marcar requisitos SÍ es del Asistente de Obra: es quien está en el sitio y
 * sabe si llegó el material o si el área quedó desocupada. Sólo toca `met`,
 * nunca los montos ni el estado de la contratación.
 */
export async function setRequirementMet(req: Request, res: Response) {
  try {
    const met = req.body?.met;
    if (typeof met !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Datos inválidos' });
    }

    const project = req.project as IProject;
    const engagement = await ProviderEngagement.findOne({
      _id: req.params.engagementId,
      project: project._id,
      provider: req.params.providerId,
    });
    if (!engagement) {
      return res.status(404).json({ success: false, error: 'Contratación no encontrada' });
    }

    const requirement = engagement.requirements.id(req.params.requirementId);
    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requisito no encontrado' });
    }

    requirement.met = met;
    await engagement.save();

    return res.json({ success: true, data: { engagement: toEngagementDTO(engagement) } });
  } catch (error) {
    console.error('❌ [ENGAGEMENT] setRequirementMet:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function deleteProviderEngagement(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const engagement = await ProviderEngagement.findOneAndDelete({
      _id: req.params.engagementId,
      project: project._id,
      provider: req.params.providerId,
    });

    if (!engagement) {
      return res.status(404).json({ success: false, error: 'Contratación no encontrada' });
    }

    return res.json({ success: true, data: { engagementId: String(engagement._id) } });
  } catch (error) {
    console.error('❌ [ENGAGEMENT] deleteProviderEngagement:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
