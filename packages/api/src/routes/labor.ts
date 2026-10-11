import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import { listDayAttendance, listLaborRecords, upsertLaborRecord } from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/labor` — ver routes/project.ts.
 * `crew.attendance.write`: la asistencia la toma el supervisor a diario — es
 * su fila más literal en la matriz de roles. Las lecturas van con `crew.read`
 * y no abiertas: quién está en obra es información operativa interna y el
 * cliente no la ve (regla 4).
 */
export const laborRouter = Router({ mergeParams: true });

laborRouter.use(isAuthenticated, requireProjectAccess);

laborRouter.get('/', requireCapability('crew.read'), listLaborRecords);
// La asistencia del día completa, para el resumen de la obra y las filas.
laborRouter.get('/attendance', requireCapability('crew.read'), listDayAttendance);
laborRouter.post('/', requireCapability('crew.attendance.write'), upsertLaborRecord);

export default laborRouter;
