import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '../controllers/index.js';

/** Anidado bajo `/api/projects/:projectId/activities` — ver routes/project.ts. */
export const activityRouter = Router({ mergeParams: true });

activityRouter.use(isAuthenticated, requireProjectAccess);

activityRouter.get('/', listActivities);
activityRouter.post('/', requireProjectOwner, createActivity);
activityRouter.patch('/:activityId', requireProjectOwner, updateActivity);
activityRouter.delete('/:activityId', requireProjectOwner, deleteActivity);

export default activityRouter;
