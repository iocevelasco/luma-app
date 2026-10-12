import type { NextFunction, Request, Response } from 'express';
import {
  createCrewMemberSchema,
  createProviderSchema,
  setAssignedProjectsSchema,
  updateCrewMemberSchema,
  updateProviderSchema,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { CrewGoal } from '../models/CrewGoal.js';
import { CrewMember } from '../models/CrewMember.js';
import { Expense } from '../models/Expense.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { Project, type IProject } from '../models/Project.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { Provider } from '../models/Provider.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';
import { findMyOrganizationId } from '../services/organization.service.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { toCrewMemberDTO } from './crew.controller.js';
import { toProviderDTO } from './provider.controller.js';

/**
 * Directorio de proveedores y empleados de la Empresa.
 *
 * Dos vistas del mismo dato:
 *
 * - **Desde la Empresa** (`/api/organizations/me/...`): alta, edición, baja y en
 *   qué obras está cada uno. Sólo el dueño de la Empresa — la grilla de
 *   permisos es por obra y no tiene celdas para este nivel.
 * - **Desde una obra** (`/api/projects/:id/providers|crew/directory`): sumar a
 *   la obra lo que ya está en la Empresa, o sacarlo. Sale con
 *   `provider.manage` / `crew.manage`, las mismas celdas que ya existían.
 *
 * Express 4 no atrapa el `throw` de un handler async: todo va por `next(error)`.
 */

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Envuelve un handler async para que sus `throw` lleguen al `errorHandler`. */
function wrap(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

async function myOrganizationId(req: Request): Promise<string> {
  const organizationId = req.user ? await findMyOrganizationId(req.user.sub) : null;
  if (!organizationId) throw notFound('No tenés una empresa todavía.');
  return organizationId;
}

function parseOrThrow<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: unknown } } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);
  return parsed.data;
}

/** Agrupa los ids de obra por entidad, para no hacer una consulta por fila. */
function groupProjectIds<T extends { project: unknown }>(
  links: T[],
  key: (link: T) => string,
): Map<string, string[]> {
  const byEntity = new Map<string, string[]>();
  for (const link of links) {
    const id = key(link);
    byEntity.set(id, [...(byEntity.get(id) ?? []), String(link.project)]);
  }
  return byEntity;
}

// --- Qué impide sacar a alguien de una obra ---

async function providerUsedInProject(projectId: unknown, providerId: unknown): Promise<boolean> {
  const activityIds = await Activity.find({ project: projectId }).distinct('_id');
  const [inActivity, inEngagement, inExpense] = await Promise.all([
    ActivityProvider.exists({ provider: providerId, activity: { $in: activityIds } }),
    ProviderEngagement.exists({ project: projectId, provider: providerId }),
    Expense.exists({ project: projectId, provider: providerId }),
  ]);
  return Boolean(inActivity || inEngagement || inExpense);
}

async function crewUsedInProject(projectId: unknown, crewMemberId: unknown): Promise<boolean> {
  const activityIds = await Activity.find({ project: projectId }).distinct('_id');
  const [inActivity, inAttendance, inGoal] = await Promise.all([
    ActivityCrew.exists({ crewMember: crewMemberId, activity: { $in: activityIds } }),
    LaborRecord.exists({ project: projectId, presentCrewMembers: crewMemberId }),
    CrewGoal.exists({ project: projectId, crewMember: crewMemberId }),
  ]);
  return Boolean(inActivity || inAttendance || inGoal);
}

// ===========================================================================
// Desde la Empresa: proveedores
// ===========================================================================

/**
 * Sólo los de alcance Empresa: los que trae el cliente para una sola obra se
 * ven desde esa obra. `$ne: 'project'` y no `eq: 'organization'` porque los
 * creados antes de que existiera `scope` no tienen el campo.
 */
export const listOrganizationProviders = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const providers = await Provider.find({
    organization: organizationId,
    scope: { $ne: 'project' },
    active: true,
  }).sort({ name: 1 });

  const links = await ProjectProvider.find({ provider: { $in: providers.map((p) => p._id) } });
  const byProvider = groupProjectIds(links, (link) => String(link.provider));

  return res.json({
    success: true,
    data: {
      providers: providers.map((provider) => ({
        ...toProviderDTO(provider),
        projectIds: byProvider.get(String(provider._id)) ?? [],
      })),
    },
  });
});

export const createOrganizationProvider = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const data = parseOrThrow(createProviderSchema, req.body);

  // El alcance no viaja en el body: desde la Empresa siempre es de la Empresa.
  const provider = await Provider.create({
    ...data,
    scope: 'organization',
    organization: organizationId,
    project: null,
  });

  return res
    .status(201)
    .json({ success: true, data: { provider: { ...toProviderDTO(provider), projectIds: [] } } });
});

export const updateOrganizationProvider = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const data = parseOrThrow(updateProviderSchema, req.body);

  const provider = await Provider.findOneAndUpdate(
    { _id: req.params.providerId, organization: organizationId, scope: { $ne: 'project' } },
    data,
    { new: true },
  );
  if (!provider) throw notFound('No encontramos a ese proveedor.');

  const links = await ProjectProvider.find({ provider: provider._id });
  return res.json({
    success: true,
    data: {
      provider: { ...toProviderDTO(provider), projectIds: links.map((l) => String(l.project)) },
    },
  });
});

/** Baja lógica: sigue existiendo para las actividades donde ya trabajó. */
export const deactivateOrganizationProvider = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const provider = await Provider.findOneAndUpdate(
    { _id: req.params.providerId, organization: organizationId, scope: { $ne: 'project' } },
    { active: false },
    { new: true },
  );
  if (!provider) throw notFound('No encontramos a ese proveedor.');

  return res.json({
    success: true,
    data: { provider: { ...toProviderDTO(provider), projectIds: [] } },
  });
});

export const setOrganizationProviderProjects = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const { projectIds } = parseOrThrow(setAssignedProjectsSchema, req.body);

  const provider = await Provider.findOne({
    _id: req.params.providerId,
    organization: organizationId,
    scope: { $ne: 'project' },
  });
  if (!provider) throw notFound('No encontramos a ese proveedor.');

  const projects = await Project.find({ _id: { $in: projectIds }, organization: organizationId });
  if (projects.length !== new Set(projectIds).size) {
    throw badRequest('Hay obras que no son de tu Empresa.');
  }

  const current = await ProjectProvider.find({ provider: provider._id });
  const currentIds = new Set(current.map((link) => String(link.project)));
  const wanted = new Set(projectIds);

  const toRemove = [...currentIds].filter((id) => !wanted.has(id));
  for (const projectId of toRemove) {
    if (await providerUsedInProject(projectId, provider._id)) {
      const project = await Project.findById(projectId).select('name');
      throw conflict(
        `No se puede sacar a ${provider.name} de «${project?.name ?? 'esa obra'}»: ya tiene actividades, contrataciones o gastos ahí.`,
      );
    }
  }

  const toAdd = [...wanted].filter((id) => !currentIds.has(id));
  if (toAdd.length > 0) {
    await ProjectProvider.insertMany(
      toAdd.map((project) => ({ project, provider: provider._id })),
      { ordered: false },
    );
  }
  if (toRemove.length > 0) {
    await ProjectProvider.deleteMany({ provider: provider._id, project: { $in: toRemove } });
  }

  return res.json({
    success: true,
    data: { provider: { ...toProviderDTO(provider), projectIds: [...wanted] } },
  });
});

// ===========================================================================
// Desde la Empresa: empleados
// ===========================================================================

export const listOrganizationCrew = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const crewMembers = await CrewMember.find({
    organization: organizationId,
    scope: { $ne: 'project' },
    active: true,
  }).sort({ name: 1 });

  const links = await ProjectCrewMember.find({ crewMember: { $in: crewMembers.map((m) => m._id) } });
  const byMember = groupProjectIds(links, (link) => String(link.crewMember));

  return res.json({
    success: true,
    data: {
      crewMembers: crewMembers.map((member) => ({
        ...toCrewMemberDTO(member),
        projectIds: byMember.get(String(member._id)) ?? [],
      })),
    },
  });
});

export const createOrganizationCrewMember = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const data = parseOrThrow(createCrewMemberSchema, req.body);

  const crewMember = await CrewMember.create({
    ...data,
    scope: 'organization',
    organization: organizationId,
    project: null,
  });

  return res.status(201).json({
    success: true,
    data: { crewMember: { ...toCrewMemberDTO(crewMember), projectIds: [] } },
  });
});

export const updateOrganizationCrewMember = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const data = parseOrThrow(updateCrewMemberSchema, req.body);

  const crewMember = await CrewMember.findOneAndUpdate(
    { _id: req.params.crewMemberId, organization: organizationId, scope: { $ne: 'project' } },
    data,
    { new: true },
  );
  if (!crewMember) throw notFound('No encontramos a esa persona.');

  const links = await ProjectCrewMember.find({ crewMember: crewMember._id });
  return res.json({
    success: true,
    data: {
      crewMember: {
        ...toCrewMemberDTO(crewMember),
        projectIds: links.map((l) => String(l.project)),
      },
    },
  });
});

export const deactivateOrganizationCrewMember = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const crewMember = await CrewMember.findOneAndUpdate(
    { _id: req.params.crewMemberId, organization: organizationId, scope: { $ne: 'project' } },
    { active: false },
    { new: true },
  );
  if (!crewMember) throw notFound('No encontramos a esa persona.');

  return res.json({
    success: true,
    data: { crewMember: { ...toCrewMemberDTO(crewMember), projectIds: [] } },
  });
});

export const setOrganizationCrewMemberProjects = wrap(async (req, res) => {
  const organizationId = await myOrganizationId(req);
  const { projectIds } = parseOrThrow(setAssignedProjectsSchema, req.body);

  const crewMember = await CrewMember.findOne({
    _id: req.params.crewMemberId,
    organization: organizationId,
    scope: { $ne: 'project' },
  });
  if (!crewMember) throw notFound('No encontramos a esa persona.');

  const projects = await Project.find({ _id: { $in: projectIds }, organization: organizationId });
  if (projects.length !== new Set(projectIds).size) {
    throw badRequest('Hay obras que no son de tu Empresa.');
  }

  const current = await ProjectCrewMember.find({ crewMember: crewMember._id });
  const currentIds = new Set(current.map((link) => String(link.project)));
  const wanted = new Set(projectIds);

  const toRemove = [...currentIds].filter((id) => !wanted.has(id));
  for (const projectId of toRemove) {
    if (await crewUsedInProject(projectId, crewMember._id)) {
      const project = await Project.findById(projectId).select('name');
      throw conflict(
        `No se puede sacar a ${crewMember.name} de «${project?.name ?? 'esa obra'}»: ya tiene actividades, asistencia o metas ahí.`,
      );
    }
  }

  const toAdd = [...wanted].filter((id) => !currentIds.has(id));
  if (toAdd.length > 0) {
    await ProjectCrewMember.insertMany(
      toAdd.map((project) => ({ project, crewMember: crewMember._id })),
      { ordered: false },
    );
  }
  if (toRemove.length > 0) {
    await ProjectCrewMember.deleteMany({
      crewMember: crewMember._id,
      project: { $in: toRemove },
    });
  }

  return res.json({
    success: true,
    data: { crewMember: { ...toCrewMemberDTO(crewMember), projectIds: [...wanted] } },
  });
});

// ===========================================================================
// Desde una obra
// ===========================================================================

/** Lo de la Empresa que esta obra todavía no tiene. */
export const listProviderDirectory = wrap(async (req, res) => {
  const project = req.project as IProject;
  const assigned = await ProjectProvider.find({ project: project._id }).distinct('provider');
  const providers = await Provider.find({
    organization: project.organization,
    scope: { $ne: 'project' },
    active: true,
    _id: { $nin: assigned },
  }).sort({ name: 1 });

  return res.json({ success: true, data: { providers: providers.map(toProviderDTO) } });
});

export const addProviderToProject = wrap(async (req, res) => {
  const project = req.project as IProject;
  const provider = await Provider.findOne({
    _id: req.params.providerId,
    organization: project.organization,
    scope: { $ne: 'project' },
    active: true,
  });
  if (!provider) throw notFound('No encontramos a ese proveedor.');

  await ProjectProvider.updateOne(
    { project: project._id, provider: provider._id },
    { $setOnInsert: { project: project._id, provider: provider._id } },
    { upsert: true },
  );

  return res.status(201).json({ success: true, data: { provider: toProviderDTO(provider) } });
});

export const removeProviderFromProject = wrap(async (req, res) => {
  const project = req.project as IProject;
  const providerId = req.params.providerId;

  const link = await ProjectProvider.findOne({ project: project._id, provider: providerId });
  if (!link) throw notFound('Ese proveedor no está en esta obra.');

  if (await providerUsedInProject(project._id, providerId)) {
    throw conflict(
      'Ese proveedor ya tiene actividades, contrataciones o gastos en esta obra. Para sacarlo, primero quitá lo asignado.',
    );
  }

  await link.deleteOne();
  return res.json({ success: true, data: { providerId: String(providerId) } });
});

export const listCrewDirectory = wrap(async (req, res) => {
  const project = req.project as IProject;
  const assigned = await ProjectCrewMember.find({ project: project._id }).distinct('crewMember');
  const crewMembers = await CrewMember.find({
    organization: project.organization,
    scope: { $ne: 'project' },
    active: true,
    _id: { $nin: assigned },
  }).sort({ name: 1 });

  return res.json({ success: true, data: { crewMembers: crewMembers.map(toCrewMemberDTO) } });
});

export const addCrewMemberToProject = wrap(async (req, res) => {
  const project = req.project as IProject;
  const crewMember = await CrewMember.findOne({
    _id: req.params.crewMemberId,
    organization: project.organization,
    scope: { $ne: 'project' },
    active: true,
  });
  if (!crewMember) throw notFound('No encontramos a esa persona.');

  await ProjectCrewMember.updateOne(
    { project: project._id, crewMember: crewMember._id },
    { $setOnInsert: { project: project._id, crewMember: crewMember._id } },
    { upsert: true },
  );

  return res.status(201).json({ success: true, data: { crewMember: toCrewMemberDTO(crewMember) } });
});

export const removeCrewMemberFromProject = wrap(async (req, res) => {
  const project = req.project as IProject;
  const crewMemberId = req.params.crewMemberId;

  const link = await ProjectCrewMember.findOne({ project: project._id, crewMember: crewMemberId });
  if (!link) throw notFound('Esa persona no está en esta obra.');

  if (await crewUsedInProject(project._id, crewMemberId)) {
    throw conflict(
      'Esa persona ya tiene actividades, asistencia o metas en esta obra. Para sacarla, primero quitá lo asignado.',
    );
  }

  await link.deleteOne();
  return res.json({ success: true, data: { crewMemberId: String(crewMemberId) } });
});
