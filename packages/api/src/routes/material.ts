import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectEditor } from '../middleware/project.middleware.js';
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/materials` — ver routes/project.ts.
 * `requireProjectEditor`: el Asistente de Obra registra materiales, es el
 * principal generador de datos del sistema.
 */
export const materialRouter = Router({ mergeParams: true });

materialRouter.use(isAuthenticated, requireProjectAccess);

materialRouter.get('/', listMaterials);
materialRouter.post('/', requireProjectEditor, createMaterial);
materialRouter.patch('/:materialId', requireProjectEditor, updateMaterial);
materialRouter.delete('/:materialId', requireProjectEditor, deleteMaterial);

export default materialRouter;
