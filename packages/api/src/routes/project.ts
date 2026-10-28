import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  createProject,
  deleteProject,
  getProject,
  getProjectDeletionSummary,
  listDeletedProjects,
  restoreProject,
  inviteProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  listProjects,
  updateProject,
} from '../controllers/index.js';
import { activityRouter } from './activity.js';
import { materialRouter } from './material.js';
import { laborRouter } from './labor.js';
import { budgetRouter } from './budget.js';
import { advisorRouter } from './advisor.js';
import { providerRouter } from './provider.js';
import { crewRouter } from './crew.js';
import { documentRouter } from './document.js';
import { milestoneRouter } from './milestone.js';
import { financeRouter } from './payment.js';

export const projectRouter = Router();

projectRouter.use(isAuthenticated);

projectRouter.post('/', createProject);
projectRouter.get('/', listProjects);
// La papelera va antes de `/:projectId`, o "papelera" se leería como un id.
projectRouter.get('/papelera', listDeletedProjects);
projectRouter.post('/papelera/:projectId/restaurar', restoreProject);
projectRouter.get('/:projectId', requireProjectAccess, getProject);
projectRouter.patch('/:projectId', requireProjectAccess, requireCapability('project.update'), updateProject);
projectRouter.get(
  '/:projectId/deletion-summary',
  requireProjectAccess,
  requireCapability('project.delete'),
  getProjectDeletionSummary,
);
projectRouter.delete(
  '/:projectId',
  requireProjectAccess,
  requireCapability('project.delete'),
  deleteProject,
);
projectRouter.post(
  '/:projectId/members',
  requireProjectAccess,
  requireCapability('project.invite'),
  inviteProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
);

// Cada router anidado repite `isAuthenticated` + `requireProjectAccess`: son
// idempotentes y así quedan autocontenidos si algún día se montan aparte.
projectRouter.patch(
  '/:projectId/members/:membershipId',
  requireProjectAccess,
  requireCapability('project.invite'),
  updateProjectMemberRole,
);
projectRouter.delete(
  '/:projectId/members/:membershipId',
  requireProjectAccess,
  requireCapability('project.invite'),
  removeProjectMember,
);

projectRouter.use('/:projectId/activities', activityRouter);
projectRouter.use('/:projectId/materials', materialRouter);
projectRouter.use('/:projectId/labor', laborRouter);
projectRouter.use('/:projectId/budget', budgetRouter);
projectRouter.use('/:projectId/advisor', advisorRouter);
projectRouter.use('/:projectId/providers', providerRouter);
projectRouter.use('/:projectId/crew', crewRouter);
projectRouter.use('/:projectId/documents', documentRouter);
projectRouter.use('/:projectId/milestones', milestoneRouter);
projectRouter.use('/:projectId/finance', financeRouter);

export default projectRouter;
