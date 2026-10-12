import type { IProject } from '../models/Project.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';

/**
 * Qué proveedores y empleados ve una obra. Fuente única: antes cada controller
 * armaba su propio filtro y eran cuatro copias del mismo `$or`.
 *
 * Visible = asignado a la obra (`ProjectProvider` / `ProjectCrewMember`) más
 * los propios de la obra (`project` seteado, alcance `project`). Lo que está en
 * la libreta de la Empresa y no se asignó a esta obra no aparece.
 */
export async function visibleProviderFilter(project: IProject) {
  const assigned = await ProjectProvider.find({ project: project._id }).distinct('provider');
  return {
    organization: project.organization,
    $or: [{ project: project._id }, { _id: { $in: assigned } }],
  };
}

export async function visibleCrewFilter(project: IProject) {
  const assigned = await ProjectCrewMember.find({ project: project._id }).distinct('crewMember');
  return {
    organization: project.organization,
    $or: [{ project: project._id }, { _id: { $in: assigned } }],
  };
}
