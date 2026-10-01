import type { Request, Response } from 'express';
import {
  assignCrewToActivitySchema,
  laborRecordSchema,
  type ActivityCrewMember,
  type LaborRecord as LaborRecordDTO,
} from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import { LaborRecord, type ILaborRecord } from '../models/LaborRecord.js';
import type { IProject } from '../models/Project.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

/** Mismo alcance que el resto: roster de la Empresa más el propio de la obra. */
function crewVisibleFromProject(project: IProject) {
  return {
    organization: project.organization,
    $or: [{ scope: { $ne: 'project' } }, { project: project._id }],
  };
}

/**
 * `viewerCanSeeDetail` en `false` oculta el teléfono: el cliente invitado no
 * ve la asignación individual de personal, y menos sus datos de contacto.
 */
function toCrewMemberDTO(member: ICrewMember, viewerCanSeeDetail: boolean): ActivityCrewMember {
  return {
    crewMemberId: String(member._id),
    name: member.name,
    specialty: member.specialty,
    phone: viewerCanSeeDetail ? member.phone : undefined,
    isLead: member.isLead,
  };
}

/** La actividad tiene que ser de esta obra: si no, un id a mano cruzaría obras. */
async function findActivityInProject(project: IProject, activityId: string) {
  return Activity.findOne({ _id: activityId, project: project._id });
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function listActivityCrew(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await findActivityInProject(project, String(req.params.activityId));
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const links = await ActivityCrew.find({ activity: activity._id }).populate<{
      crewMember: ICrewMember;
    }>('crewMember');

    const crew = links
      .filter((link) => link.crewMember)
      .map((link) => toCrewMemberDTO(link.crewMember, Boolean(req.isProjectEditor)));

    return res.json({ success: true, data: { crew } });
  } catch (error) {
    console.error('❌ [LABOR] listActivityCrew:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` antes. La asistencia de TODAS las
 * actividades vigentes ese día, en una sola consulta.
 *
 * Va junta y no actividad por actividad porque la pantalla necesita el total
 * de la obra arriba —con cuánta gente se cuenta hoy— y pedir la cuadrilla de
 * cada actividad por separado sería un N+1 para responder una suma.
 */
export async function listDayAttendance(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { date } = req.query as { date?: string };
    if (!date) {
      return res.status(400).json({ success: false, error: 'Falta la fecha' });
    }

    const viewerCanSeeDetail = Boolean(req.isProjectEditor);

    // Vigentes ese día: la misma regla que usa la pantalla para listarlas.
    const activities = await Activity.find({
      project: project._id,
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).select('_id');
    const activityIds = activities.map((activity) => activity._id);

    const [crewLinks, records] = await Promise.all([
      ActivityCrew.find({ activity: { $in: activityIds } }).populate<{
        crewMember: ICrewMember;
      }>('crewMember'),
      LaborRecord.find({ project: project._id, date, activity: { $in: activityIds } }),
    ]);

    const expectedByActivity = new Map<string, ActivityCrewMember[]>();
    for (const link of crewLinks) {
      if (!link.crewMember) continue;
      const key = String(link.activity);
      const list = expectedByActivity.get(key) ?? [];
      list.push(toCrewMemberDTO(link.crewMember, viewerCanSeeDetail));
      expectedByActivity.set(key, list);
    }

    const recordByActivity = new Map(records.map((record) => [String(record.activity), record]));

    const attendance = activityIds.map((activityId) => {
      const key = String(activityId);
      const record = recordByActivity.get(key);
      return {
        activityId: key,
        expected: expectedByActivity.get(key) ?? [],
        presentCrewMemberIds: viewerCanSeeDetail
          ? (record?.presentCrewMembers ?? []).map(String)
          : [],
        legacyPresentNames: viewerCanSeeDetail ? (record?.presentNames ?? []) : [],
        legacyExpectedCount: record?.expectedCount ?? 0,
      };
    });

    return res.json({ success: true, data: { attendance } });
  } catch (error) {
    console.error('❌ [LABOR] listDayAttendance:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function assignCrewToActivity(req: Request, res: Response) {
  try {
    const parsed = assignCrewToActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const activity = await findActivityInProject(project, String(req.params.activityId));
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const member = await CrewMember.findOne({
      _id: parsed.data.crewMemberId,
      ...crewVisibleFromProject(project),
    });
    if (!member) {
      return res.status(404).json({ success: false, error: 'Personal no encontrado' });
    }

    const already = await ActivityCrew.exists({ activity: activity._id, crewMember: member._id });
    if (already) {
      return res
        .status(409)
        .json({ success: false, error: 'Esa persona ya está asignada a la actividad' });
    }

    await ActivityCrew.create({ activity: activity._id, crewMember: member._id });

    return res
      .status(201)
      .json({ success: true, data: { crewMember: toCrewMemberDTO(member, true) } });
  } catch (error) {
    console.error('❌ [LABOR] assignCrewToActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/** Requiere `requireProjectAccess` + `requireProjectEditor` antes. */
export async function unassignCrewFromActivity(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const activity = await findActivityInProject(project, String(req.params.activityId));
    if (!activity) {
      return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
    }

    const link = await ActivityCrew.findOneAndDelete({
      activity: activity._id,
      crewMember: req.params.crewMemberId,
    });
    if (!link) {
      return res.status(404).json({ success: false, error: 'Esa persona no está asignada' });
    }

    return res.json({ success: true, data: { crewMemberId: String(req.params.crewMemberId) } });
  } catch (error) {
    console.error('❌ [LABOR] unassignCrewFromActivity:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * `viewerCanSeeDetail` en `false` vacía `presentNames` — regla de negocio: el
 * cliente invitado no ve "la asignación individual de personal". El dueño Y
 * el Asistente de Obra sí (es quien la toma). `presentCount` sale siempre de
 * `record.presentNames.length` real, para que el dashboard no reporte 0
 * presentes sólo porque quien mira es el cliente.
 */
function toLaborRecordDTO(record: ILaborRecord, viewerCanSeeDetail: boolean): LaborRecordDTO {
  const present = record.presentCrewMembers ?? [];
  return {
    id: String(record._id),
    projectId: String(record.project),
    activityId: String(record.activity),
    date: record.date,
    presentCrewMemberIds: viewerCanSeeDetail ? present.map(String) : [],
    expectedCount: record.expectedCount,
    presentNames: viewerCanSeeDetail ? record.presentNames : [],
    // Los partes viejos cuentan por nombres tipeados; los nuevos, por gente
    // del roster. Nunca hay las dos cosas en el mismo parte.
    presentCount: present.length > 0 ? present.length : record.presentNames.length,
    createdBy: String(record.createdBy),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Requiere `requireProjectAccess` antes. Acepta `date` (`YYYY-MM-DD`) para acotar a un día. */
export async function listLaborRecords(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const { date } = req.query as { date?: string };
    const viewerCanSeeDetail = Boolean(req.isProjectEditor);

    const filter: Record<string, unknown> = { project: project._id };
    if (date) filter.date = date;

    const records = await LaborRecord.find(filter).sort({ date: -1 });

    return res.json({
      success: true,
      data: { laborRecords: records.map((record) => toLaborRecordDTO(record, viewerCanSeeDetail)) },
    });
  } catch (error) {
    console.error('❌ [LABOR] listLaborRecords:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireProjectEditor` antes. Upsert por
 * (activity, date) — ver LaborRecord.ts. `createdBy` sólo se fija al crear,
 * nunca se pisa en una actualización posterior del mismo día.
 */
export async function upsertLaborRecord(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const parsed = laborRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, error: 'Datos inválidos', details: parsed.error.issues });
    }

    const project = req.project as IProject;
    const { activityId, date, presentCrewMemberIds } = parsed.data;

    const activity = await Activity.findOne({ _id: activityId, project: project._id });
    if (!activity) {
      return res
        .status(400)
        .json({ success: false, error: 'La actividad no pertenece a esta obra' });
    }

    // Todos los presentes tienen que ser del roster visible desde esta obra:
    // un id a mano no puede meter gente de la Empresa de otro.
    if (presentCrewMemberIds.length > 0) {
      const valid = await CrewMember.countDocuments({
        _id: { $in: presentCrewMemberIds },
        organization: project.organization,
        $or: [{ scope: { $ne: 'project' } }, { project: project._id }],
      });
      if (valid !== new Set(presentCrewMemberIds).size) {
        return res
          .status(400)
          .json({ success: false, error: 'Hay personal que no pertenece a esta obra' });
      }
    }

    const record = await LaborRecord.findOneAndUpdate(
      { project: project._id, activity: activityId, date },
      {
        $set: { presentCrewMembers: presentCrewMemberIds },
        $setOnInsert: { project: project._id, activity: activityId, date, createdBy: req.user.sub },
      },
      { new: true, upsert: true },
    );

    // Esta ruta requiere `requireProjectEditor` — quien la llama siempre puede
    // ver el detalle completo de lo que acaba de escribir.
    return res
      .status(200)
      .json({ success: true, data: { laborRecord: toLaborRecordDTO(record, true) } });
  } catch (error) {
    console.error('❌ [LABOR] upsertLaborRecord:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}
