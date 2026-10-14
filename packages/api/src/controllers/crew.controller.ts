import type { NextFunction, Request, Response } from 'express';
import {
  createCrewMemberSchema,
  updateCrewMemberSchema,
  type CrewMember as CrewMemberDTO,
} from '@luma/shared';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import type { IProject } from '../models/Project.js';
import { assertNoCrewDuplicate } from '../services/crew-identity.service.js';
import { visibleCrewFilter } from '../services/directory.service.js';
import { badRequest } from '../utils/errors.js';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Error inesperado';
}

export function toCrewMemberDTO(member: ICrewMember): CrewMemberDTO {
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

// --- Roster ---

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
export async function listCrewMembers(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const crewMembers = await CrewMember.find({
      ...(await visibleCrewFilter(project)),
      active: true,
    }).sort({ name: 1 });

    return res.json({ success: true, data: { crewMembers: crewMembers.map(toCrewMemberDTO) } });
  } catch (error) {
    console.error('❌ [CREW] listCrewMembers:', error);
    return res.status(500).json({ success: false, error: errMsg(error) });
  }
}

/**
 * Requiere `requireProjectAccess` + `requireCapability('crew.create')`: lo
 * hacen el gerente y el supervisor.
 *
 * Todo alta va a la libreta de la Empresa y queda asignada a esta obra. Ya no
 * existe el "sólo para esta obra": un obrero cargado acá tiene que poder
 * sumarse a la próxima sin recrearlo.
 *
 * Antes de crear, el guardia de duplicados (`crew-identity.service.ts`): si
 * ya está en la Empresa, 409 con la persona existente para sumarla en vez de
 * duplicarla.
 *
 * El jornal es plata: sólo se guarda si quien carga puede ver gastos. El
 * supervisor no lo ve, así que tampoco lo escribe — ni con un `curl`.
 */
export async function createCrewMember(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createCrewMemberSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const project = req.project as IProject;
    const { allowDuplicateName, dailyRate, ...fields } = parsed.data;

    await assertNoCrewDuplicate(
      project.organization,
      { name: fields.name, phone: fields.phone, kind: fields.kind, allowDuplicateName },
      String(project._id),
    );

    const crewMember = await CrewMember.create({
      ...fields,
      ...(dailyRate !== undefined && req.can?.('expense.read') ? { dailyRate } : {}),
      scope: 'organization',
      organization: project.organization,
      project: null,
    });
    await ProjectCrewMember.create({ project: project._id, crewMember: crewMember._id });

    return res
      .status(201)
      .json({ success: true, data: { crewMember: toCrewMemberDTO(crewMember) } });
  } catch (error) {
    return next(error);
  }
}

/** Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. */
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
      { _id: req.params.crewMemberId, ...(await visibleCrewFilter(project)) },
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
 * Requiere `requireProjectAccess` + el `requireCapability(...)` que declara el router antes. Baja lógica:
 * quien ya no está sigue siendo el dueño de las metas de semanas pasadas.
 */
export async function deactivateCrewMember(req: Request, res: Response) {
  try {
    const project = req.project as IProject;
    const crewMember = await CrewMember.findOneAndUpdate(
      { _id: req.params.crewMemberId, ...(await visibleCrewFilter(project)) },
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
