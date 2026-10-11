import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireCapability,
  requireProjectAccess,
} from '../middleware/project.middleware.js';
import {
  createCrewGoal,
  createCrewMember,
  deactivateCrewMember,
  deleteCrewGoal,
  listCrewGoals,
  listCrewMembers,
  updateCrewGoal,
  updateCrewMember,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/crew` — ver routes/project.ts.
 *
 * El roster lo administra el gerente (`crew.manage`), igual que el directorio
 * de proveedores. Las metas semanales las carga y marca también el supervisor
 * (`crew.goals.write`), que es quien chequea en el día si cada uno está en lo
 * suyo.
 *
 * El cliente final no ve nada de esto: la asignación individual de personal
 * es información operativa interna (regla 4 del documento funcional).
 */
export const crewRouter = Router({ mergeParams: true });

crewRouter.use(isAuthenticated, requireProjectAccess);

crewRouter.get('/', requireCapability('crew.read'), listCrewMembers);
crewRouter.post('/', requireCapability('crew.manage'), createCrewMember);
crewRouter.patch('/:crewMemberId', requireCapability('crew.manage'), updateCrewMember);
crewRouter.delete('/:crewMemberId', requireCapability('crew.manage'), deactivateCrewMember);

// `/goals` antes que `/:crewMemberId` no hace falta: no hay GET por id de
// personal, así que no hay ambigüedad posible.
crewRouter.get('/goals', requireCapability('crew.read'), listCrewGoals);
crewRouter.post('/goals', requireCapability('crew.goals.write'), createCrewGoal);
crewRouter.patch('/goals/:goalId', requireCapability('crew.goals.write'), updateCrewGoal);
crewRouter.delete('/goals/:goalId', requireCapability('crew.goals.write'), deleteCrewGoal);

export default crewRouter;
