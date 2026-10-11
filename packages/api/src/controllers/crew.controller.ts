import type { Request, Response } from 'express';
import {
  createCrewGoalSchema,
  createCrewMemberSchema,
  updateCrewGoalSchema,
  updateCrewMemberSchema,
  type CrewGoal as CrewGoalDTO,
  type CrewGoalWithMember,
  type CrewMember as CrewMemberDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { CrewGoal, type ICrewGoal } from '../models/CrewGoal.js';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * Mismo criterio de alcance que `provider.controller.ts`: el roster de la
 * Empresa más el personal contratado sólo para esta obra. `$ne: 'project'`
 * y no `eq: 'organization'` para que las filas viejas sin el campo sigan
 * apareciendo.
 */
function visibleFromProject(project: IProject) {
  return {
    organization: project.organization,
    $or: [{ scope: { $ne: 'project' } }, { project: project._id }],
  };
}

function toCrewMemberDTO(member: ICrewMember): CrewMemberDTO {
  return {
    id: String(member._id),
    organizationId: String(member.organization),
    scope: member.scope,
    projectId: member.project ? String(member.project) : undefined,
    name: member.name,
    kind: member.kind,
    specialty: member.specialty,
    isLead: member.isLead,
    phone: member.phone,
    notes: member.notes,
    active: member.active,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function toGoalDTO(goal: ICrewGoal): CrewGoalDTO {
  return {
    id: String(goal._id),
    projectId: String(goal.project),
    crewMemberId: String(goal.crewMember),
    weekStart: goal.weekStart,
    description: goal.description,
    activityId: goal.activity ? String(goal.activity) : undefined,
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

// --- Roster ---

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function listCrewMembers(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const crewMembers = await CrewMember.find({
      ...visibleFromProject(project),
      active: true,
    }).sort({ name: 1 });

    return res.json({ success: true, data: { crewMembers: crewMembers.map(toCrewMemberDTO) } });
  } catch (error) {
    console.error('❌ [CREW] listCrewMembers:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function createCrewMember(req: Request, res: Response) {
  try {
    const parsed = createCrewMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const crewMember = await CrewMember.create({
      ...parsed.data,
      organization: project.organization,
      project: parsed.data.scope === 'project' ? project._id : null,
    });

    return res
      .status(201)
      .json({ success: true, data: { crewMember: toCrewMemberDTO(crewMember) } });
  } catch (error) {
    console.error('❌ [CREW] createCrewMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectOwner` antes. */
export async function updateCrewMember(req: Request, res: Response) {
  try {
    const parsed = updateCrewMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const crewMember = await CrewMember.findOneAndUpdate(
      { _id: req.params.crewMemberId, ...visibleFromProject(project) },
      parsed.data,
      { new: true },
    );

    if (!crewMember) {
      return res.status(404).json({ success: false, error: 'Personal no encontrado' });
    }

    return res.json({ success: true, data: { crewMember: toCrewMemberDTO(crewMember) } });
  } catch (error) {
    console.error('❌ [CREW] updateCrewMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectOwner` antes. Baja lógica:
 * quien ya no está sigue siendo el dueño de las metas de semanas pasadas.
 */
export async function deactivateCrewMember(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const crewMember = await CrewMember.findOneAndUpdate(
      { _id: req.params.crewMemberId, ...visibleFromProject(project) },
      { active: false },
      { new: true },
    );

    if (!crewMember) {
      return res.status(404).json({ success: false, error: 'Personal no encontrado' });
    }

    return res.json({ success: true, data: { crewMember: toCrewMemberDTO(crewMember) } });
  } catch (error) {
    console.error('❌ [CREW] deactivateCrewMember:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

// --- Metas semanales ---

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Filtra por
 * `?weekStart=YYYY-MM-DD`; sin el parámetro devuelve todas las de la obra.
 *
 * Trae el nombre de cada destinatario resuelto: la pantalla de metas siempre
 * los necesita, y pedir el roster aparte para cruzarlo a mano es una llamada
 * extra garantizada.
 */
export async function listCrewGoals(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { weekStart } = req.query as { weekStart?: string };

    const filter: Record<string, unknown> = { project: project._id };
    if (weekStart) filter.weekStart = weekStart;

    const goals = await CrewGoal.find(filter)
      .sort({ weekStart: 1, createdAt: 1 })
      .populate<{ crewMember: ICrewMember }>('crewMember');

    const withMember: CrewGoalWithMember[] = goals
      .filter((goal) => goal.crewMember)
      .map((goal) => ({
        ...toGoalDTO(goal as unknown as ICrewGoal),
        crewMemberId: String(goal.crewMember._id),
        crewMemberName: goal.crewMember.name,
        crewMemberKind: goal.crewMember.kind,
      }));

    return res.json({ success: true, data: { goals: withMember } });
  } catch (error) {
    console.error('❌ [CREW] listCrewGoals:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Planificar
 * la semana es trabajo operativo: lo hace el dueño o el Asistente de Obra.
 */
export async function createCrewGoal(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createCrewGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;

    const crewMember = await CrewMember.findOne({
      _id: parsed.data.crewMemberId,
      ...visibleFromProject(project),
    });
    if (!crewMember) {
      return res.status(404).json({ success: false, error: 'Personal no encontrado' });
    }

    if (parsed.data.activityId) {
      const activity = await Activity.findOne({
        _id: parsed.data.activityId,
        project: project._id,
      });
      if (!activity) {
        return res
          .status(400)
          .json({ success: false, error: 'Esa actividad no pertenece a esta obra' });
      }
    }

    const goal = await CrewGoal.create({
      project: project._id,
      crewMember: crewMember._id,
      weekStart: parsed.data.weekStart,
      description: parsed.data.description,
      activity: parsed.data.activityId ?? null,
      status: parsed.data.status,
      createdBy: req.user.sub,
    });

    return res.status(201).json({ success: true, data: { goal: toGoalDTO(goal) } });
  } catch (error) {
    console.error('❌ [CREW] createCrewGoal:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function updateCrewGoal(req: Request, res: Response) {
  try {
    const parsed = updateCrewGoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { activityId, ...rest } = parsed.data;

    if (activityId) {
      const activity = await Activity.findOne({ _id: activityId, project: project._id });
      if (!activity) {
        return res
          .status(400)
          .json({ success: false, error: 'Esa actividad no pertenece a esta obra' });
      }
    }

    const goal = await CrewGoal.findOneAndUpdate(
      { _id: req.params.goalId, project: project._id },
      { ...rest, ...(activityId ? { activity: activityId } : {}) },
      { new: true },
    );

    if (!goal) {
      return res.status(404).json({ success: false, error: 'Meta no encontrada' });
    }

    return res.json({ success: true, data: { goal: toGoalDTO(goal) } });
  } catch (error) {
    console.error('❌ [CREW] updateCrewGoal:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. Borrado duro. */
export async function deleteCrewGoal(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const goal = await CrewGoal.findOneAndDelete({
      _id: req.params.goalId,
      project: project._id,
    });

    if (!goal) {
      return res.status(404).json({ success: false, error: 'Meta no encontrada' });
    }

    return res.json({ success: true, data: { goalId: String(goal._id) } });
  } catch (error) {
    console.error('❌ [CREW] deleteCrewGoal:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
