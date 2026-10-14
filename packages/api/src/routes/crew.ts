import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireCapability,
  requireProjectAccess,
} from '../middleware/project.middleware.js';
import {
  addCrewMemberToProject,
  createCrewMember,
  deactivateCrewMember,
  listCrewDirectory,
  listCrewMembers,
  removeCrewMemberFromProject,
  updateCrewMember,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/crew` — ver routes/project.ts.
 *
 * Sumar gente a la obra —crearla, o buscarla en la Empresa y traerla— lo
 * hacen el gerente y el supervisor (`crew.create`): el supervisor es quien
 * está cuando llega alguien nuevo, y si no pudiera buscar sólo le quedaría
 * duplicarlo. Editar, dar de baja y sacar de la obra sigue siendo del gerente
 * (`crew.manage`). Lo que cada uno tiene que hacer son tareas (`/activities`).
 *
 * El cliente final no ve nada de esto: la asignación individual de personal
 * es información operativa interna (regla 4 del documento funcional).
 */
export const crewRouter = Router({ mergeParams: true });

crewRouter.use(isAuthenticated, requireProjectAccess);

crewRouter.get('/', requireCapability('crew.read'), listCrewMembers);
crewRouter.post('/', requireCapability('crew.create'), createCrewMember);

// Sumar a esta obra lo que ya está en la libreta de la Empresa. Antes que
// `/:crewMemberId` para que "directory" no se lea como un id.
crewRouter.get('/directory', requireCapability('crew.create'), listCrewDirectory);
// Reactivar a alguien dado de baja además pide `crew.manage`: lo chequea el controller.
crewRouter.post('/directory/:crewMemberId', requireCapability('crew.create'), addCrewMemberToProject);
crewRouter.delete(
  '/directory/:crewMemberId',
  requireCapability('crew.manage'),
  removeCrewMemberFromProject,
);
crewRouter.patch('/:crewMemberId', requireCapability('crew.manage'), updateCrewMember);
crewRouter.delete('/:crewMemberId', requireCapability('crew.manage'), deactivateCrewMember);

export default crewRouter;
