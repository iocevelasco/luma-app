import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireCapability,
  requireProjectAccess,
} from '../middleware/project.middleware.js';
import {
  assignCrewToActivity,
  assignProvider,
  createActivity,
  deleteActivity,
  deleteActivityEvidence,
  listActivities,
  listActivityCrew,
  listActivityProviders,
  rejectActivity,
  unassignCrewFromActivity,
  unassignProvider,
  updateActivity,
  uploadActivityEvidence,
} from '../controllers/index.js';

/**
 * Memoria, no disco: el archivo va directo al storage S3-compatible en el
 * controller — no hay filesystem persistente en el VPS entre deploys.
 */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

/** El límite de tamaño de multer llega como error acá, antes del errorHandler global. */
function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'El archivo es demasiado grande (máximo 8MB)' });
  }
  next(err);
}

/**
 * Anidado bajo `/api/projects/:projectId/activities` — ver routes/project.ts.
 *
 * Cada ruta declara QUÉ acción es (`activity.plan`, `activity.report`…) y
 * quién puede hacerla lo decide la grilla de `@luma/shared/permissions`. La
 * división que importa acá: planificar es del gerente, reportar es del
 * supervisor. Por eso crear y borrar van con `activity.plan` y el PATCH con
 * `activity.report` — qué campos puede tocar cada uno lo afina el controller,
 * que es el único que ve el body.
 */
export const activityRouter = Router({ mergeParams: true });

activityRouter.use(isAuthenticated, requireProjectAccess);

activityRouter.get('/', requireCapability('activity.read'), listActivities);
activityRouter.post('/', requireCapability('activity.plan'), createActivity);
activityRouter.patch('/:activityId', requireCapability('activity.report'), updateActivity);
// Devolver el trabajo y darlo por terminado son la misma decisión del gerente
// (`activity.review`). Cerrar se gatea dentro de `updateActivity`, que es
// quien ve el estado pedido en el body.
activityRouter.post('/:activityId/reject', requireCapability('activity.review'), rejectActivity);
activityRouter.delete('/:activityId', requireCapability('activity.plan'), deleteActivity);
activityRouter.post(
  '/:activityId/evidence',
  requireCapability('activity.evidence.write'),
  upload.single('photo'),
  handleUploadError,
  uploadActivityEvidence,
);
activityRouter.delete(
  '/:activityId/evidence/:evidenceId',
  requireCapability('activity.evidence.write'),
  deleteActivityEvidence,
);

// Proveedores asignados (directorio de la Empresa — ver routes/provider.ts).
// Leer pasa por `provider.read`, que para el cliente además depende del flag
// `providersVisibleToClient` de la obra; asignar es del gerente y el supervisor.
activityRouter.get(
  '/:activityId/providers',
  requireCapability('provider.read'),
  listActivityProviders,
);
activityRouter.post('/:activityId/providers', requireCapability('provider.assign'), assignProvider);
activityRouter.delete(
  '/:activityId/providers/:providerId',
  requireCapability('provider.assign'),
  unassignProvider,
);

// Cuadrilla fija de la actividad: quiénes se esperan todos los días. El parte
// diario (`/labor`) sólo confirma quién de ellos vino.
activityRouter.get('/:activityId/crew', requireCapability('crew.read'), listActivityCrew);
activityRouter.post(
  '/:activityId/crew',
  requireCapability('crew.manage'),
  assignCrewToActivity,
);
activityRouter.delete(
  '/:activityId/crew/:crewMemberId',
  requireCapability('crew.manage'),
  unassignCrewFromActivity,
);

export default activityRouter;
