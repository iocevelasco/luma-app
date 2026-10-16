import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  addMilestoneAttachment,
  createMilestone,
  deleteMilestone,
  listMilestones,
  removeMilestoneAttachment,
  updateMilestone,
} from '../controllers/index.js';
import { AppError } from '../utils/errors.js';

/**
 * Memoria, no disco: el archivo va directo al media-service desde el
 * controller. Mismo límite que la documentación de obra.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
});

/** El límite de multer llega como error acá; se traduce a un error con `code`. */
function handleUploadError(err: unknown, _req: Request, _res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return next(
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError('PAYLOAD_TOO_LARGE', 'El archivo es demasiado grande (máximo 20MB).')
        : new AppError('VALIDATION', 'Subí un archivo por vez.'),
    );
  }
  next(err);
}

/**
 * Anidado bajo `/api/projects/:projectId/milestones` — ver routes/project.ts.
 *
 * Las escrituras van con `milestone.report` (gerente y supervisor). Publicar
 * hacia el cliente necesita además `milestone.publish`, y eso **no se puede
 * expresar en el router**: depende del `audience` que venga en el body, así
 * que el chequeo vive en el controller. Es la misma situación que cerrar una
 * actividad en `updateActivity`.
 */
export const milestoneRouter = Router({ mergeParams: true });

milestoneRouter.use(isAuthenticated, requireProjectAccess);

milestoneRouter.get('/', requireCapability('milestone.read'), listMilestones);
milestoneRouter.post('/', requireCapability('milestone.report'), createMilestone);
milestoneRouter.patch('/:milestoneId', requireCapability('milestone.report'), updateMilestone);
milestoneRouter.delete('/:milestoneId', requireCapability('milestone.report'), deleteMilestone);

milestoneRouter.post(
  '/:milestoneId/attachments',
  requireCapability('milestone.report'),
  upload.single('file'),
  handleUploadError,
  addMilestoneAttachment,
);
milestoneRouter.delete(
  '/:milestoneId/attachments/:attachmentId',
  requireCapability('milestone.report'),
  removeMilestoneAttachment,
);

export default milestoneRouter;
