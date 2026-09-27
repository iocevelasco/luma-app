import type { Request, Response } from 'express';
import {
  assignActivitySchema,
  assignProviderSchema,
  createProviderSchema,
  updateProviderSchema,
  type Provider as ProviderDTO,
  type ProviderActivitySummary,
} from '@luma/shared';
import { Provider, type IProvider } from '../models/Provider.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { Activity, type IActivity } from '../models/Activity.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toActivitySummaryDTO(activity: IActivity): ProviderActivitySummary {
  return {
    id: String(activity._id),
    name: activity.name,
    area: activity.area,
    startDate: activity.startDate,
    endDate: activity.endDate,
    status: activity.status,
  };
}

function toProviderDTO(provider: IProvider): ProviderDTO {
  return {
    id: String(provider._id),
    organizationId: String(provider.organization),
    name: provider.name,
    companyName: provider.companyName,
    specialty: provider.specialty,
    customSpecialty: provider.customSpecialty,
    phone: provider.phone,
    email: provider.email,
    notes: provider.notes,
    active: provider.active,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString(),
  };
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. El
 * directorio es de la Empresa (`project.organization`), no de la obra — por
 * eso una misma lista aparece igual en cualquier proyecto de esa Empresa.
 * Sólo activos: un proveedor dado de baja no vuelve a aparecer para asignar,
 * aunque siga existiendo para las actividades donde ya está.
 */
export async function listProviders(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const providers = await Provider.find({
      organization: project.organization,
      active: true,
    }).sort({ name: 1 });

    return res.json({ success: true, data: { providers: providers.map(toProviderDTO) } });
  } catch (error) {
    console.error('❌ [PROVIDER] listProviders:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function createProvider(req: Request, res: Response) {
  try {
    const parsed = createProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const provider = await Provider.create({ ...parsed.data, organization: project.organization });

    return res.status(201).json({ success: true, data: { provider: toProviderDTO(provider) } });
  } catch (error) {
    console.error('❌ [PROVIDER] createProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function updateProvider(req: Request, res: Response) {
  try {
    const parsed = updateProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.providerId, organization: project.organization },
      parsed.data,
      { new: true },
    );

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    return res.json({ success: true, data: { provider: toProviderDTO(provider) } });
  } catch (error) {
    console.error('❌ [PROVIDER] updateProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Baja
 * lógica: nunca se borra el documento (ver comentario en `models/Provider.ts`).
 */
export async function deactivateProvider(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const provider = await Provider.findOneAndUpdate(
      { _id: req.params.providerId, organization: project.organization },
      { active: false },
      { new: true },
    );

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    return res.json({ success: true, data: { provider: toProviderDTO(provider) } });
  } catch (error) {
    console.error('❌ [PROVIDER] deactivateProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Incluye
 * proveedores inactivos a propósito: si ya trabajó en esta actividad, sigue
 * apareciendo acá aunque se haya dado de baja del directorio general.
 */
export async function listActivityProviders(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({
      _id: req.params.activityId,
      project: project._id,
    });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const links = await ActivityProvider.find({ activity: activity._id }).populate<{
      provider: IProvider;
    }>('provider');

    const providers = links
      .filter((link) => link.provider)
      .map((link) => toProviderDTO(link.provider));

    return res.json({ success: true, data: { providers } });
  } catch (error) {
    console.error('❌ [PROVIDER] listActivityProviders:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function assignProvider(req: Request, res: Response) {
  try {
    const parsed = assignProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const activity = await Activity.findOne({
      _id: req.params.activityId,
      project: project._id,
    });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const provider = await Provider.findOne({
      _id: parsed.data.providerId,
      organization: project.organization,
    });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const alreadyAssigned = await ActivityProvider.exists({
      activity: activity._id,
      provider: provider._id,
    });
    if (alreadyAssigned) {
      return res
        .status(409)
        .json({ success: false, error: 'Ese proveedor ya está asignado a la actividad' });
    }

    await ActivityProvider.create({ activity: activity._id, provider: provider._id });

    return res.status(201).json({ success: true, data: { provider: toProviderDTO(provider) } });
  } catch (error) {
    console.error('❌ [PROVIDER] assignProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function unassignProvider(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({
      _id: req.params.activityId,
      project: project._id,
    });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const link = await ActivityProvider.findOneAndDelete({
      activity: activity._id,
      provider: req.params.providerId,
    });

    if (!link) {
      return res.status(404).json({ success: false, error: 'Ese proveedor no está asignado' });
    }

    return res.json({ success: true, data: { providerId: req.params.providerId } });
  } catch (error) {
    console.error('❌ [PROVIDER] unassignProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Misma
 * relación N:N que `listActivityProviders`, vista desde el lado del
 * proveedor — para el listado de Proveedores, que hasta ahora sólo permitía
 * asignar desde el detalle de la Actividad.
 *
 * Alcance deliberado: sólo actividades de ESTE proyecto, aunque el
 * directorio sea de la Empresa y el mismo proveedor pueda estar en obras
 * distintas — mostrar "todas mis obras" es una vista nueva (organización, no
 * proyecto) que no está pedida todavía.
 */
export async function listProviderActivities(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const provider = await Provider.findOne({
      _id: req.params.providerId,
      organization: project.organization,
    });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const links = await ActivityProvider.find({ provider: provider._id }).populate<{
      activity: IActivity;
    }>('activity');

    const activities = links
      .filter((link) => link.activity && String(link.activity.project) === String(project._id))
      .map((link) => toActivitySummaryDTO(link.activity));

    return res.json({ success: true, data: { activities } });
  } catch (error) {
    console.error('❌ [PROVIDER] listProviderActivities:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function assignActivityToProvider(req: Request, res: Response) {
  try {
    const parsed = assignActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const provider = await Provider.findOne({
      _id: req.params.providerId,
      organization: project.organization,
    });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const activity = await Activity.findOne({
      _id: parsed.data.activityId,
      project: project._id,
    });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const alreadyAssigned = await ActivityProvider.exists({
      activity: activity._id,
      provider: provider._id,
    });
    if (alreadyAssigned) {
      return res
        .status(409)
        .json({ success: false, error: 'Ese proveedor ya está asignado a la actividad' });
    }

    await ActivityProvider.create({ activity: activity._id, provider: provider._id });

    return res
      .status(201)
      .json({ success: true, data: { activity: toActivitySummaryDTO(activity) } });
  } catch (error) {
    console.error('❌ [PROVIDER] assignActivityToProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function unassignActivityFromProvider(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const provider = await Provider.findOne({
      _id: req.params.providerId,
      organization: project.organization,
    });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const link = await ActivityProvider.findOneAndDelete({
      activity: req.params.activityId,
      provider: provider._id,
    });

    if (!link) {
      return res.status(404).json({ success: false, error: 'Esa actividad no está asignada' });
    }

    return res.json({ success: true, data: { activityId: req.params.activityId } });
  } catch (error) {
    console.error('❌ [PROVIDER] unassignActivityFromProvider:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
