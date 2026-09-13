import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import { createProject, getProject, inviteClient, listProjects } from '../controllers/index.js';

export const projectRouter = Router();

projectRouter.use(isAuthenticated);

projectRouter.post('/', createProject);
projectRouter.get('/', listProjects);
projectRouter.get('/:projectId', requireProjectAccess, getProject);
projectRouter.post('/:projectId/clients', requireProjectAccess, requireProjectOwner, inviteClient);

export default projectRouter;
