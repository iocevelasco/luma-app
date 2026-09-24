import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectEditor } from '../middleware/project.middleware.js';
import { listLaborRecords, upsertLaborRecord } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/labor` — ver routes/project.ts.
 * `requireProjectEditor`: el Asistente de Obra toma asistencia a diario.
 */
export const laborRouter = Router({ mergeParams: true });

laborRouter.use(isAuthenticated, requireProjectAccess);

laborRouter.get('/', listLaborRecords);
laborRouter.post('/', requireProjectEditor, upsertLaborRecord);

export default laborRouter;
