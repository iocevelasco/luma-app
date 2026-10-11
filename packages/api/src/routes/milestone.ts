import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  updateMilestone,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/milestones` — ver routes/project.ts.
 *
 * Las escrituras van con `milestone.report` (gerente y supervisor). Publicar
 * hacia el cliente necesita además `milestone.publish`, y eso **no se puede
 * expresar en el router**: depende del `audience` que venga en el body, así
 * que el chequeo vive en el controller. Es la misma situación que cerrar una
 * actividad en `updateActivity`.
 */
export const milestoneRouter = Router({ mergeParams: true });

milestoneRouter.use(isAuthenticated, requireProjectAccess);

milestoneRouter.get('/', requireCapability('milestone.read'), listMilestones);
milestoneRouter.post('/', requireCapability('milestone.report'), createMilestone);
milestoneRouter.patch('/:milestoneId', requireCapability('milestone.report'), updateMilestone);
milestoneRouter.delete('/:milestoneId', requireCapability('milestone.report'), deleteMilestone);

export default milestoneRouter;
