import type mongoose from 'mongoose';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { CrewMember } from '../models/CrewMember.js';
import type { IProject } from '../models/Project.js';
import { visibleCrewFilter } from './directory.service.js';

interface ResponsibleRef {
  name: string;
  user?: string | { toString(): string } | null;
}

function sameResponsible(a: ResponsibleRef, b: ResponsibleRef): boolean {
  return a.name === b.name && String(a.user ?? '') === String(b.user ?? '');
}

/**
 * Cuando cambia el responsable de una tarea, la cuadrilla lo acompaña.
 *
 * La cuadrilla es lo que lleva la tarea a la asistencia de la Jornada. Si se
 * reasigna sin tocarla, la Jornada sigue esperando a la persona vieja y la
 * nueva —que es quien ahora responde— nunca aparece para tildar.
 *
 * Reglas:
 * - la persona nueva entra a la cuadrilla, si es personal de esta obra;
 * - la anterior sale **sólo si entró por ser la responsable**. No hay un
 *   marcador de eso en `ActivityCrew`, así que se reconoce por nombre: está
 *   en la cuadrilla y se llama igual que el responsable que se reemplaza.
 *   Cualquier otro integrante puesto a mano no se toca;
 * - un responsable administrativo (`user`) no es personal de obra: no entra
 *   a la cuadrilla, pero el anterior igual sale.
 *
 * El responsable se guarda como nombre y no como referencia, así que el cruce
 * con `CrewMember` es por nombre. Dos personas homónimas en la misma obra
 * pueden confundirse; el guardia de duplicados de Empleados existe para eso.
 */
export async function moveCrewWithResponsible({
  project,
  activityId,
  previous,
  next,
}: {
  project: IProject;
  activityId: mongoose.Types.ObjectId | string;
  previous: ResponsibleRef;
  next: ResponsibleRef;
}): Promise<void> {
  if (sameResponsible(previous, next)) return;

  const rows = await ActivityCrew.find({ activity: activityId }).select('crewMember');
  const inCrew = new Set(rows.map((row) => String(row.crewMember)));

  if (!previous.user && inCrew.size > 0) {
    const leaving = await CrewMember.find({
      _id: { $in: [...inCrew] },
      name: previous.name,
    }).select('_id');
    if (leaving.length > 0) {
      await ActivityCrew.deleteMany({
        activity: activityId,
        crewMember: { $in: leaving.map((member) => member._id) },
      });
    }
  }

  if (next.user) return;

  const joining = await CrewMember.findOne({
    ...(await visibleCrewFilter(project)),
    active: true,
    name: next.name,
  }).select('_id');
  if (!joining || inCrew.has(String(joining._id))) return;

  await ActivityCrew.updateOne(
    { activity: activityId, crewMember: joining._id },
    { $setOnInsert: { activity: activityId, crewMember: joining._id } },
    { upsert: true },
  );
}
