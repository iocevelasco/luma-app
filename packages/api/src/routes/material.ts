import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireProjectAccess, requireProjectOwner } from '../middleware/project.middleware.js';
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from '../controllers/index.js';

/** Anidado bajo `/api/projects/:projectId/materials` — ver routes/project.ts. */
export const materialRouter = Router({ mergeParams: true });

materialRouter.use(isAuthenticated, requireProjectAccess);

materialRouter.get('/', listMaterials);
materialRouter.post('/', requireProjectOwner, createMaterial);
materialRouter.patch('/:materialId', requireProjectOwner, updateMaterial);
materialRouter.delete('/:materialId', requireProjectOwner, deleteMaterial);

export default materialRouter;
