import type { Request, Response } from 'express';
import mongoose from 'mongoose';
// Import de sólo-tipos: activa la ampliación de `Express.Request.file` que
// trae `@types/multer`, aunque este archivo no llame a multer directamente
// (el middleware vive en la ruta).
import type {} from 'multer';
import {
  createActivitySchema,
  rejectActivitySchema,
  updateActivitySchema,
  type Activity as ActivityDTO,
  type ActivityEvidencePhoto,
  type ActivityStatus,
  type NotificationType,
  type ProjectRole,
} from '@luma/shared';
import { Activity, type IActivity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { CrewMember } from '../models/CrewMember.js';
import { MaterialItem } from '../models/MaterialItem.js';
import { moveCrewWithResponsible } from '../services/activity-crew.service.js';
import { visibleCrewFilter } from '../services/directory.service.js';
import { notifyProject } from '../services/notification.service.js';
import type { IProject } from '../models/Project.js';
import {
  StorageNotConfiguredError,
  deleteEvidencePhoto,
  signEvidencePhotoUrl,
  uploadEvidencePhoto,
} from '../services/storage.service.js';

const EVIDENCE_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/**
 * Firma cada `key` de evidencia al vuelo — nunca se guarda ni se cachea la
 * URL, sólo el `key` interno. Una foto sin storage configurado (`null`)
 * simplemente se omite en vez de romper toda la respuesta.
 */
async function toActivityDTO(activity: IActivity): Promise<ActivityDTO> {
  const signedEvidence = await Promise.all(
    activity.evidence.map(async (photo): Promise<ActivityEvidencePhoto | null> => {
      const url = await signEvidencePhotoUrl(photo.key);
      if (!url) return null;
      return {
        id: String(photo._id),
        url,
        uploadedBy: String(photo.uploadedBy),
        uploadedAt: photo.uploadedAt.toISOString(),
      };
    }),
  );

  return {
    id: String(activity._id),
    projectId: String(activity.project),
    name: activity.name,
    startDate: activity.startDate,
    endDate: activity.endDate,
    responsible: {
      name: activity.responsible.name,
      user: activity.responsible.user ? String(activity.responsible.user) : undefined,
    },
    status: activity.status,
    specialty: activity.specialty,
    review: activity.review
      ? {
          reportedBy: String(activity.review.reportedBy),
          reportedAt: activity.review.reportedAt.toISOString(),
          approvedBy: activity.review.approvedBy ? String(activity.review.approvedBy) : undefined,
          approvedAt: activity.review.approvedAt?.toISOString(),
          rejectedBy: activity.review.rejectedBy ? String(activity.review.rejectedBy) : undefined,
          rejectedAt: activity.review.rejectedAt?.toISOString(),
          rejectionReason: activity.review.rejectionReason,
        }
      : undefined,
    notes: activity.notes,
    evidence: signedEvidence.filter((photo): photo is ActivityEvidencePhoto => photo !== null),
    createdBy: String(activity.createdBy),
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

/** Requiere `requireProjectAccess` antes. Acepta `from`/`to` (`YYYY-MM-DD`) como rango solapado. */
export async function listActivities(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { from, to } = req.query as { from?: string; to?: string };

    const filter: Record<string, unknown> = { project: project._id };
    if (from) filter.endDate = { $gte: from };
    if (to) filter.startDate = { ...(filter.startDate as object), $lte: to };

    const activities = await Activity.find(filter).sort({ startDate: 1 });

    return res.json({
      success: true,
      data: { activities: await Promise.all(activities.map(toActivityDTO)) },
    });
  } catch (error) {
    console.error('❌ [ACTIVITY] listActivities:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireCapability('activity.create')`:
 * gerente y supervisor. La tarea es una sola entidad para el Cronograma y el
 * Tablero — se cree desde donde se cree, aparece en los dos.
 *
 * Con `crewMemberIds` nace con su cuadrilla, que es lo que la lleva a la
 * asistencia de la Jornada. Va en el alta y no en un paso aparte porque el
 * supervisor crea tareas pero no administra cuadrillas (`crew.manage`).
 */
export async function createActivity(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = createActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { crewMemberIds, ...fields } = parsed.data;

    const crewIds = [...new Set(crewMemberIds ?? [])];
    if (crewIds.length > 0) {
      const visible = await CrewMember.find({
        _id: { $in: crewIds },
        ...(await visibleCrewFilter(project)),
        active: true,
      }).select('_id');
      if (visible.length !== crewIds.length) {
        return res
          .status(400)
          .json({ success: false, error: 'Hay personas que no están en esta obra.' });
      }
    }

    const activity = await Activity.create({
      ...fields,
      project: project._id,
      createdBy: req.user.sub,
    });

    if (crewIds.length > 0) {
      await ActivityCrew.insertMany(
        crewIds.map((crewMember) => ({ activity: activity._id, crewMember })),
      );
    }

    return res
      .status(201)
      .json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] createActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes.
 *
 * Cerrar a `completada` es exclusivo del dueño de la obra: el Asistente llega
 * hasta `en_revision` (reportar terminado) y el supervisor confirma. Nadie
 * cierra su propio trabajo.
 */
export async function updateActivity(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = updateActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    // El router deja pasar `activity.report` (gerente y supervisor), pero dar
    // por terminada una actividad es la revisión, no el reporte: eso es del
    // gerente. La misma capacidad que gatea `rejectActivity`.
    if (parsed.data.status === 'completada' && !req.can?.('activity.review')) {
      return res.status(403).json({
        success: false,
        error: 'Sólo quien gestiona la obra puede dar una tarea por terminada',
      });
    }

    // El supervisor crea tareas y las mueve por el flujo, pero no las
    // modifica: fechas, responsable, alcance o cancelarla piden
    // `activity.plan`, que es del gerente.
    const PLANNING_FIELDS = ['name', 'startDate', 'endDate', 'responsible', 'specialty'] as const;
    const touchesPlanning =
      PLANNING_FIELDS.some((field) => parsed.data[field] !== undefined) ||
      parsed.data.status === 'cancelada';
    if (touchesPlanning && !req.can?.('activity.plan')) {
      return res.status(403).json({
        success: false,
        error: 'Sólo el gerente puede modificar o cancelar una tarea',
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'activity.plan' },
      });
    }

    const project = req.project as IProject;
    const activity = await Activity.findOne({
      _id: req.params.activityId,
      project: project._id,
    });

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    // Reabrir una completada deshace la aprobación del gerente: es suya.
    if (
      activity.status === 'completada' &&
      parsed.data.status &&
      parsed.data.status !== 'completada' &&
      !req.can?.('activity.review')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Sólo el gerente puede reabrir una tarea completada',
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'activity.review' },
      });
    }

    // Restaurar una cancelada es deshacer una decisión de planificación.
    if (
      activity.status === 'cancelada' &&
      parsed.data.status &&
      parsed.data.status !== 'cancelada' &&
      !req.can?.('activity.plan')
    ) {
      return res.status(403).json({
        success: false,
        error: 'Sólo el gerente puede restaurar una tarea cancelada',
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'activity.plan' },
      });
    }

    const now = new Date();
    // Antes del `set`: después, `activity.status` ya es el nuevo y no habría
    // con qué comparar para saber si hubo transición.
    const previousStatus = activity.status;
    const previousResponsible = {
      name: activity.responsible.name,
      user: activity.responsible.user,
    };
    activity.set(parsed.data);

    // Reportar terminado abre un ciclo de revisión nuevo y limpia el rechazo
    // anterior: el motivo viejo ya no aplica a lo que se acaba de reportar.
    if (parsed.data.status === 'en_revision') {
      activity.set('review', { reportedBy: req.user.sub, reportedAt: now });
    }

    if (parsed.data.status === 'completada' && activity.review) {
      activity.set('review.approvedBy', req.user.sub);
      activity.set('review.approvedAt', now);
    }

    await activity.save();

    // Reasignar no es sólo cambiar un nombre: la Jornada espera a quien está en
    // la cuadrilla de la tarea, y tiene que esperar al responsable nuevo.
    if (parsed.data.responsible) {
      await moveCrewWithResponsible({
        project,
        activityId: String(activity._id),
        previous: previousResponsible,
        next: parsed.data.responsible,
      });
    }

    if (parsed.data.status && parsed.data.status !== previousStatus) {
      await notifyForStatusChange(project, activity, parsed.data.status, req.user.sub);
    }

    return res.json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] updateActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. El supervisor
 * devuelve el trabajo: vuelve a `en_curso` con el motivo visible para quien
 * lo reportó. Sin este camino, no aprobar deja la actividad en un limbo donde
 * nadie sabe si está trabada o si el supervisor todavía no la miró.
 */
export async function rejectActivity(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = rejectActivitySchema.safeParse(req.body);
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
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    if (activity.status !== 'en_revision') {
      return res
        .status(400)
        .json({ success: false, error: 'Sólo se puede devolver una tarea en revisión' });
    }

    activity.set('status', 'en_curso');
    activity.set('review.rejectedBy', req.user.sub);
    activity.set('review.rejectedAt', new Date());
    activity.set('review.rejectionReason', parsed.data.reason);
    await activity.save();

    return res.json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] rejectActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. Borrado
 * DURO. Los `MaterialItem` asociados quedan con `activity: null` en vez de
 * borrarse en cascada. La evidencia fotográfica sí se borra del storage acá
 * — sin este paso, cada actividad borrada deja fotos huérfanas pagándose
 * solas en el bucket para siempre.
 */
export async function deleteActivity(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });

    if (!activity) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    await Promise.all(activity.evidence.map((photo) => deleteEvidencePhoto(photo.key)));
    await MaterialItem.updateMany({ activity: activity._id }, { activity: null });
    await Activity.findByIdAndDelete(activity._id);

    return res.json({ success: true, data: { activityId: String(activity._id) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] deleteActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. Multipart
 * con un único campo `photo` (`upload.single('photo')` en la ruta).
 */
export async function uploadActivityEvidence(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Falta la foto' });
  }

  const extension = EVIDENCE_MIME_TO_EXTENSION[file.mimetype];
  if (!extension) {
    return res
      .status(400)
      .json({ success: false, error: 'Formato no soportado. Subí una foto .jpg, .png o .webp' });
  }

  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    const { key } = await uploadEvidencePhoto({
      projectId: String(project._id),
      activityId: String(activity._id),
      buffer: file.buffer,
      contentType: file.mimetype,
      extension,
    });

    activity.evidence.push({ key, uploadedBy: req.user.sub, uploadedAt: new Date() });
    await activity.save();

    return res
      .status(201)
      .json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return res.status(503).json({
        success: false,
        error: 'El registro fotográfico todavía no está configurado en esta obra',
      });
    }
    console.error('❌ [ACTIVITY] uploadActivityEvidence:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function deleteActivityEvidence(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await Activity.findOne({ _id: req.params.activityId, project: project._id });
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Tarea no encontrada' });
    }

    const photo = activity.evidence.id(req.params.evidenceId);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Foto no encontrada' });
    }

    await deleteEvidencePhoto(photo.key);
    photo.deleteOne();
    await activity.save();

    return res.json({ success: true, data: { activity: await toActivityDTO(activity) } });
  } catch (error) {
    console.error('❌ [ACTIVITY] deleteActivityEvidence:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * "Recibir notificaciones de actividad iniciada, avanzada y cumplida" — la
 * fila del cliente en la matriz.
 *
 * Sólo tres de los cinco estados avisan. `pendiente` es el estado inicial y no
 * es noticia; `cancelada` sí lo sería, pero la matriz no la menciona y
 * avisarla sin que nadie la haya pedido es ruido que enseña a ignorar el
 * badge.
 *
 * `en_revision` no llega al cliente: es un paso interno del circuito de
 * validación —alguien reportó terminado y el gerente todavía no lo aprobó— y
 * anunciarlo como avance sería anunciar algo que puede volver atrás.
 */
const STATUS_NOTIFICATIONS = {
  en_curso: { type: 'actividad_iniciada', audience: ['gerente', 'supervisor', 'cliente'] },
  en_revision: { type: 'actividad_en_revision', audience: ['gerente'] },
  completada: { type: 'actividad_completada', audience: ['gerente', 'supervisor', 'cliente'] },
} as const satisfies Partial<
  Record<ActivityStatus, { type: NotificationType; audience: readonly ProjectRole[] }>
>;

async function notifyForStatusChange(
  project: IProject,
  activity: IActivity,
  status: ActivityStatus,
  actorId: string,
) {
  const config = STATUS_NOTIFICATIONS[status as keyof typeof STATUS_NOTIFICATIONS];
  if (!config) return;

  await notifyProject({
    project,
    type: config.type,
    subjectName: activity.name,
    link: `/admin/proyectos/${String(project._id)}/actividades`,
    audience: config.audience,
    actorId,
  });
}

export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}
