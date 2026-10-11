import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireProjectAccess,
  requireProjectEditor,
  requireProjectOwner,
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
 * El roster lo administra el dueño (`requireProjectOwner`), igual que el
 * directorio de proveedores. Las metas semanales son planificación operativa:
 * las carga y marca también el Asistente de Obra (`requireProjectEditor`),
 * que es quien chequea en el día si cada uno está en lo suyo.
 *
 * El cliente final no ve nada de esto: la asignación individual de personal
 * es información operativa interna (regla 4 del documento funcional).
 */
export const crewRouter = Router({ mergeParams: true });

crewRouter.use(isAuthenticated, requireProjectAccess);

crewRouter.get('/', requireProjectEditor, listCrewMembers);
crewRouter.post('/', requireProjectOwner, createCrewMember);
crewRouter.patch('/:crewMemberId', requireProjectOwner, updateCrewMember);
crewRouter.delete('/:crewMemberId', requireProjectOwner, deactivateCrewMember);

// `/goals` antes que `/:crewMemberId` no hace falta: no hay GET por id de
// personal, así que no hay ambigüedad posible.
crewRouter.get('/goals', requireProjectEditor, listCrewGoals);
crewRouter.post('/goals', requireProjectEditor, createCrewGoal);
crewRouter.patch('/goals/:goalId', requireProjectEditor, updateCrewGoal);
crewRouter.delete('/goals/:goalId', requireProjectEditor, deleteCrewGoal);

export default crewRouter;
