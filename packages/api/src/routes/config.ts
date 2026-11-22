import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { getIntegrationsConfig } from '../controllers/index.js';

/**
 * Configuración del entorno que sólo ve quien tiene sesión. La que necesitan
 * las pantallas públicas está en `routes/public.ts` (`/api/public/config`).
 */
export const configRouter = Router();

configRouter.get('/integrations', isAuthenticated, getIntegrationsConfig);

export default configRouter;
