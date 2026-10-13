import type mongoose from 'mongoose';
import {
  normalizePersonName,
  normalizePhone,
  type CrewDirectoryEntry,
  type CrewDuplicateDetails,
  type CrewMemberKind,
} from '@luma/shared';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { conflict } from '../utils/errors.js';

/**
 * Que un obrero exista una sola vez en la Empresa.
 *
 * El personal se carga desde la obra, que es donde está quien lo conoce. Sin
 * este guardia, el Juan Pérez que trabajó en la obra A se vuelve a crear en la
 * obra B, y a partir de ahí su asistencia, sus metas y su jornal viven
 * partidos en dos registros que nadie sabe que son la misma persona.
 *
 * La UI ya ofrece al existente mientras se tipea el nombre, pero eso no
 * alcanza: dos personas cargando a la vez, un `curl`, o "Juan Perez" sin
 * tilde pasan por al lado. Por eso la regla vive acá y la usan las DOS puertas
 * de alta: la de la obra y la de la Empresa.
 *
 * No hay índice único a propósito: los homónimos existen. Dos altas idénticas
 * en el mismo milisegundo pueden colarse; `migrate:crew` las lista.
 */

/** Lo justo para reconocer a alguien. Ver `CrewDirectoryEntry`. */
export function toCrewDirectoryEntry(member: ICrewMember): CrewDirectoryEntry {
  return {
    id: String(member._id),
    name: member.name,
    kind: member.kind ?? 'persona',
    specialty: member.specialty,
    isLead: Boolean(member.isLead),
  };
}

interface CrewCandidate {
  name: string;
  phone?: string;
  kind: CrewMemberKind;
  allowDuplicateName?: boolean;
}

type MatchReason = CrewDuplicateDetails['reason'];

/** El primero activo gana: si hay uno vigente y otro dado de baja, el vigente es a quien hay que sumar. */
function pickMatch(matches: ICrewMember[]): ICrewMember | undefined {
  return matches.find((member) => member.active) ?? matches[0];
}

/**
 * ¿Choca con alguien de la Empresa? `null` si no.
 *
 * - **Teléfono** primero, y sin excepción: el mismo número es la misma
 *   persona. Sólo dentro del mismo tipo, para que el equipo que lleva el
 *   teléfono de su encargado no choque con él.
 * - **Nombre** después, sin mayúsculas ni tildes. Se puede insistir con
 *   `allowDuplicateName` ("es otra persona").
 *
 * Entran los dados de baja: alguien que vuelve a trabajar se reactiva, no se
 * recrea. Quedan afuera los "sólo para esta obra" de OTRAS obras: hasta que
 * corra `migrate:crew` son privados de su obra y desde acá no se podrían sumar.
 */
export async function findCrewDuplicate(
  organization: mongoose.Types.ObjectId | string,
  candidate: CrewCandidate,
  projectId?: mongoose.Types.ObjectId | string,
): Promise<CrewDuplicateDetails | null> {
  const phone = normalizePhone(candidate.phone);
  const name = normalizePersonName(candidate.name);

  const sameKind = (
    await CrewMember.find({
      organization,
      $or: [{ scope: { $ne: 'project' } }, ...(projectId ? [{ project: projectId }] : [])],
    }).select('name phone kind specialty isLead active scope project')
  ).filter((member) => (member.kind ?? 'persona') === candidate.kind);

  let reason: MatchReason | undefined;
  let match: ICrewMember | undefined;

  if (phone) {
    match = pickMatch(sameKind.filter((member) => normalizePhone(member.phone) === phone));
    if (match) reason = 'phone';
  }
  if (!match && !candidate.allowDuplicateName) {
    match = pickMatch(sameKind.filter((member) => normalizePersonName(member.name) === name));
    if (match) reason = 'name';
  }
  if (!match || !reason) return null;

  const alreadyInProject = projectId
    ? String(match.project) === String(projectId) ||
      Boolean(await ProjectCrewMember.exists({ project: projectId, crewMember: match._id }))
    : false;

  return {
    reason,
    existing: { ...toCrewDirectoryEntry(match), active: Boolean(match.active) },
    alreadyInProject,
  };
}

/** El texto del 409, desde el lado de quien carga. El `details` es para la máquina. */
function duplicateMessage({ reason, existing, alreadyInProject }: CrewDuplicateDetails): string {
  // Dado de baja primero: aunque siga vinculado a la obra, no aparece en
  // ninguna lista, y "ya está en esta obra" dejaría a la persona sin pista.
  if (!existing.active) return `${existing.name} ya está en la Empresa, pero dado de baja.`;
  if (alreadyInProject && reason === 'name') {
    return `Ya hay alguien llamado ${existing.name} en esta obra.`;
  }
  if (alreadyInProject) return `${existing.name} ya está en esta obra.`;
  if (reason === 'phone') return `Ese teléfono ya es de ${existing.name}, que está en la Empresa.`;
  return `Ya hay alguien llamado ${existing.name} en la Empresa.`;
}

/** Lanza un `CONFLICT` con la persona existente si el alta la duplicaría. */
export async function assertNoCrewDuplicate(
  organization: mongoose.Types.ObjectId | string,
  candidate: CrewCandidate,
  projectId?: mongoose.Types.ObjectId | string,
): Promise<void> {
  const duplicate = await findCrewDuplicate(organization, candidate, projectId);
  if (duplicate) throw conflict(duplicateMessage(duplicate), duplicate);
}
