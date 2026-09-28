import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import {
  createProject,
  getProject,
  inviteClient,
  listProjects,
  updateProject,
} from '../controllers/index.js';
import { activityRouter } from './activity.js';
import { materialRouter } from './material.js';
import { laborRouter } from './labor.js';
import { budgetRouter } from './budget.js';
import { advisorRouter } from './advisor.js';
import { providerRouter } from './provider.js';

export const projectRouter = Router();

projectRouter.use(isAuthenticated);

projectRouter.post('/', createProject);
projectRouter.get('/', listProjects);
projectRouter.get('/:projectId', requireProjectAccess, getProject);
projectRouter.patch('/:projectId', requireProjectAccess, requireProjectOwner, updateProject);
projectRouter.post('/:projectId/clients', requireProjectAccess, requireProjectOwner, inviteClient);

// Cada router anidado repite `isAuthenticated` + `requireProjectAccess`: son
// idempotentes y así quedan autocontenidos si algún día se montan aparte.
projectRouter.use('/:projectId/activities', activityRouter);
projectRouter.use('/:projectId/materials', materialRouter);
projectRouter.use('/:projectId/labor', laborRouter);
projectRouter.use('/:projectId/budget', budgetRouter);
projectRouter.use('/:projectId/advisor', advisorRouter);
projectRouter.use('/:projectId/providers', providerRouter);

export default projectRouter;
