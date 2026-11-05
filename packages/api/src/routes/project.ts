import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import { closeLiveOnAccessChange, publishLiveChanges } from '../middleware/live.middleware.js';
import {
  createProject,
  createProjectSpecialty,
  updateProjectSpecialty,
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
import { liveRouter } from './live.js';

export const projectRouter = Router();

projectRouter.use(isAuthenticated);

projectRouter.post('/', createProject);
projectRouter.get('/', listProjects);
// La papelera va antes de `/:projectId`, o "papelera" se leería como un id.
projectRouter.get('/papelera', listDeletedProjects);
projectRouter.post('/papelera/:projectId/restaurar', restoreProject);
projectRouter.get('/:projectId', requireProjectAccess, getProject);
projectRouter.patch(
  '/:projectId',
  closeLiveOnAccessChange(),
  requireProjectAccess,
  requireCapability('project.update'),
  updateProject,
);
projectRouter.post(
  '/:projectId/specialties',
  requireProjectAccess,
  requireCapability('specialty.manage'),
  createProjectSpecialty,
);
projectRouter.patch(
  '/:projectId/specialties/:key',
  requireProjectAccess,
  requireCapability('specialty.manage'),
  updateProjectSpecialty,
);
projectRouter.get(
  '/:projectId/deletion-summary',
  requireProjectAccess,
  requireCapability('project.delete'),
  getProjectDeletionSummary,
);
projectRouter.delete(
  '/:projectId',
  closeLiveOnAccessChange(),
  requireProjectAccess,
  requireCapability('project.delete'),
  deleteProject,
);
projectRouter.post(
  '/:projectId/members',
  closeLiveOnAccessChange(),
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
  closeLiveOnAccessChange(),
  requireProjectAccess,
  requireCapability('project.invite'),
  updateProjectMemberRole,
);
projectRouter.delete(
  '/:projectId/members/:membershipId',
  closeLiveOnAccessChange(),
  requireProjectAccess,
  requireCapability('project.invite'),
  removeProjectMember,
);

// Tiempo real: Actividades y Materiales avisan a la obra tras cada escritura
// exitosa (ver middleware/live.middleware.ts). El resto de los recursos se
// refresca por polling en la SPA, así que no cuelga nada acá.
projectRouter.use('/:projectId/activities', publishLiveChanges, activityRouter);
projectRouter.use('/:projectId/materials', publishLiveChanges, materialRouter);
projectRouter.use('/:projectId/live', liveRouter);
projectRouter.use('/:projectId/labor', laborRouter);
projectRouter.use('/:projectId/budget', budgetRouter);
projectRouter.use('/:projectId/advisor', advisorRouter);
projectRouter.use('/:projectId/providers', providerRouter);
projectRouter.use('/:projectId/crew', crewRouter);
projectRouter.use('/:projectId/documents', documentRouter);
projectRouter.use('/:projectId/milestones', milestoneRouter);
projectRouter.use('/:projectId/finance', financeRouter);

export default projectRouter;
