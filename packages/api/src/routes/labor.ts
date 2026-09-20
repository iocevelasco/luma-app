import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import { listLaborRecords, upsertLaborRecord } from '../controllers/index.js';

/** Anidado bajo `/api/projects/:projectId/labor` — ver routes/project.ts. */
export const laborRouter = Router({ mergeParams: true });

laborRouter.use(isAuthenticated, requireProjectAccess);

laborRouter.get('/', listLaborRecords);
laborRouter.post('/', requireProjectOwner, upsertLaborRecord);

export default laborRouter;
