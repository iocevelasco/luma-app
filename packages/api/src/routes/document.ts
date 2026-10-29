import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { DOCUMENT_MAX_BYTES } from '@luma/shared';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireCapability, requireProjectAccess } from '../middleware/project.middleware.js';
import {
  createProjectDocument,
  deleteProjectDocument,
  getProjectDocumentFile,
  listProjectDocuments,
  updateProjectDocument,
} from '../controllers/index.js';

/**
 * Memoria, no disco: el archivo va directo al storage S3-compatible en el
 * controller — no hay filesystem persistente en el VPS entre deploys.
 *
 * El límite es mayor que el de la evidencia fotográfica (8MB) porque un plano
 * en PDF pesa bastante más que una foto de avance.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOCUMENT_MAX_BYTES },
});

/** El límite de tamaño de multer llega como error acá, antes del errorHandler global. */
function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ success: false, error: 'El archivo es demasiado grande (máximo 20MB)' });
  }
  next(err);
}

/**
 * Anidado bajo `/api/projects/:projectId/documents` — ver routes/project.ts.
 *
 * Lectura para los tres roles (`document.read`): es la columna derecha de la
 * matriz, lo único operativo que se le abre al cliente sin pasar por un flag.
 * Escritura sólo del gerente (`document.write`) — "cargar actualización de
 * documentación y planos de ejecución" es su fila, no la del supervisor.
 */
export const documentRouter = Router({ mergeParams: true });

documentRouter.use(isAuthenticated, requireProjectAccess);

documentRouter.get('/', requireCapability('document.read'), listProjectDocuments);
documentRouter.get('/:documentId/file', requireCapability('document.read'), getProjectDocumentFile);
documentRouter.post(
  '/',
  requireCapability('document.write'),
  upload.single('file'),
  handleUploadError,
  createProjectDocument,
);
documentRouter.patch(
  '/:documentId',
  requireCapability('document.write'),
  updateProjectDocument,
);
documentRouter.delete(
  '/:documentId',
  requireCapability('document.write'),
  deleteProjectDocument,
);

export default documentRouter;
