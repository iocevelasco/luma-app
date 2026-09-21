import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectEditor } from '../middleware/project.middleware.js';
import {
  createActivity,
  deleteActivity,
  deleteActivityEvidence,
  listActivities,
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
 * `requireProjectEditor` (no `requireProjectOwner`): el Asistente de Obra
 * también planifica y actualiza actividades, sólo presupuesto e
 * invitaciones quedan exclusivas del dueño.
 */
export const activityRouter = Router({ mergeParams: true });

activityRouter.use(isAuthenticated, requireProjectAccess);

activityRouter.get('/', listActivities);
activityRouter.post('/', requireProjectEditor, createActivity);
activityRouter.patch('/:activityId', requireProjectEditor, updateActivity);
activityRouter.delete('/:activityId', requireProjectEditor, deleteActivity);
activityRouter.post(
  '/:activityId/evidence',
  requireProjectEditor,
  upload.single('photo'),
  handleUploadError,
  uploadActivityEvidence,
);
activityRouter.delete(
  '/:activityId/evidence/:evidenceId',
  requireProjectEditor,
  deleteActivityEvidence,
);

export default activityRouter;
