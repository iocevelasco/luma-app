import type { Request, Response } from 'express';
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  type Milestone as MilestoneDTO,
} from '@luma/shared';
import { Milestone, type IMilestone } from '../models/Milestone.js';
import { Activity } from '../models/Activity.js';
import { User } from '../models/User.js';
import type { IProject } from '../models/Project.js';
import { notifyProject } from '../services/notification.service.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

function toMilestoneDTO(
  milestone: IMilestone,
  reporterName: string,
  activityName?: string,
): MilestoneDTO {
  return {
    id: String(milestone._id),
    projectId: String(milestone.project),
    type: milestone.type,
    audience: milestone.audience,
    severity: milestone.severity,
    title: milestone.title,
    description: milestone.description || undefined,
    occurredOn: milestone.occurredOn,
    activityId: milestone.activity ? String(milestone.activity) : undefined,
    activityName,
    reportedBy: String(milestone.reportedBy),
    reportedByName: reporterName,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
  };
}

/** Nombres de quienes reportaron y de las actividades enlazadas, en dos consultas. */
async function resolveNames(milestones: IMilestone[]) {
  const userIds = [...new Set(milestones.map((m) => String(m.reportedBy)))];
  const activityIds = [
    ...new Set(milestones.filter((m) => m.activity).map((m) => String(m.activity))),
  ];

  const [users, activities] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('name'),
    activityIds.length > 0
      ? Activity.find({ _id: { $in: activityIds } }).select('name')
      : Promise.resolve([]),
  ]);

  return {
    userNames: new Map(users.map((user) => [String(user._id), user.name])),
    activityNames: new Map(activities.map((activity) => [String(activity._id), activity.name])),
  };
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * El cliente ve sólo los hitos de audiencia `cliente`. **Ese filtro no es un
 * permiso sino parte de la consulta**: `milestone.read` lo tienen los tres
 * roles, y lo que cambia es cuántas filas devuelve. Si fuera una capacidad
 * aparte habría que inventar una por cada audiencia futura.
 */
export async function listMilestones(req: Request, res: Response) {
  try {
    const project = req.project as IProject;

    const filter: Record<string, unknown> = { project: project._id };
    if (!req.can?.('milestone.report')) {
      filter.audience = 'cliente';
    }

    const docs = await Milestone.find(filter).sort({ occurredOn: -1, createdAt: -1 }).limit(200);
    const { userNames, activityNames } = await resolveNames(docs);

    const milestones = docs.map((doc) =>
      toMilestoneDTO(
        doc,
        userNames.get(String(doc.reportedBy)) ?? '',
        doc.activity ? activityNames.get(String(doc.activity)) : undefined,
      ),
    );

    return res.json({ success: true, data: { milestones } });
  } catch (error) {
    console.error('❌ [MILESTONE] listMilestones:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * El router deja pasar `milestone.report` (gerente y supervisor). Publicar
 * hacia el cliente necesita además `milestone.publish`, que sólo tiene el
 * gerente: la fila del supervisor dice "notificar eventualidades **solamente
 * al gerente**".
 */
export async function createMilestone(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    if (parsed.data.audience === 'cliente' && !req.can?.('milestone.publish')) {
      return res.status(403).json({
        success: false,
        error: 'Sólo quien gestiona la obra puede publicar un hito para el cliente',
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'milestone.publish' },
      });
    }

    const project = req.project as IProject;
    const { activityId, ...rest } = parsed.data;

    // Una actividad de otra obra enlazada acá filtraría su nombre a quien no
    // tiene acceso a ella. Se valida la pertenencia antes de guardarla.
    let activity: string | null = null;
    if (activityId) {
      const found = await Activity.findOne({ _id: activityId, project: project._id }).select('_id');
      if (!found) {
        return res.status(400).json({ success: false, error: 'La actividad no es de esta obra' });
      }
      activity = String(found._id);
    }

    const milestone = await Milestone.create({
      project: project._id,
      ...rest,
      activity,
      reportedBy: req.user.sub,
    });

    await notifyForMilestone(project, milestone, req.user.sub);

    const reporter = await User.findById(req.user.sub).select('name');

    return res.status(201).json({
      success: true,
      data: { milestone: toMilestoneDTO(milestone, reporter?.name ?? '') },
    });
  } catch (error) {
    console.error('❌ [MILESTONE] createMilestone:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Un hito al cliente lo reciben los tres roles; una eventualidad interna, sólo
 * gerente y supervisor — nunca el cliente, que es la mitad del punto de que la
 * audiencia exista.
 */
async function notifyForMilestone(project: IProject, milestone: IMilestone, actorId: string) {
  const isPublic = milestone.audience === 'cliente';

  await notifyProject({
    project,
    type: isPublic ? 'hito' : 'eventualidad',
    subjectName: milestone.title,
    link: `/admin/proyectos/${String(project._id)}/hitos`,
    audience: isPublic ? ['gerente', 'supervisor', 'cliente'] : ['gerente', 'supervisor'],
    actorId,
  });
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function updateMilestone(req: Request, res: Response) {
  try {
    const parsed = updateMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    if (parsed.data.audience === 'cliente' && !req.can?.('milestone.publish')) {
      return res.status(403).json({
        success: false,
        error: 'Sólo quien gestiona la obra puede publicar un hito para el cliente',
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'milestone.publish' },
      });
    }

    const project = req.project as IProject;
    const milestone = await Milestone.findOne({
      _id: req.params.milestoneId,
      project: project._id,
    });

    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Hito no encontrado' });
    }

    // Un supervisor no puede editar lo que publicó el gerente: cambiar el
    // título de un hito que el cliente ya recibió lo deja leyendo otra cosa.
    if (milestone.audience === 'cliente' && !req.can?.('milestone.publish')) {
      return res
        .status(403)
        .json({ success: false, error: 'No podés editar un hito publicado al cliente' });
    }

    milestone.set(parsed.data);
    await milestone.save();

    const reporter = await User.findById(milestone.reportedBy).select('name');

    return res.json({
      success: true,
      data: { milestone: toMilestoneDTO(milestone, reporter?.name ?? '') },
    });
  } catch (error) {
    console.error('❌ [MILESTONE] updateMilestone:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. Borrado duro. */
export async function deleteMilestone(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const milestone = await Milestone.findOne({
      _id: req.params.milestoneId,
      project: project._id,
    });

    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Hito no encontrado' });
    }

    if (milestone.audience === 'cliente' && !req.can?.('milestone.publish')) {
      return res
        .status(403)
        .json({ success: false, error: 'No podés borrar un hito publicado al cliente' });
    }

    await Milestone.findByIdAndDelete(milestone._id);

    return res.json({ success: true, data: { milestoneId: String(milestone._id) } });
  } catch (error) {
    console.error('❌ [MILESTONE] deleteMilestone:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
