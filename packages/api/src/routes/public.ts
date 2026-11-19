import { Router } from 'express';
import {
  getCampaignImage,
  getPublicConfig,
  unsubscribe,
  unsubscribePage,
} from '../controllers/index.js';

/**
 * Lo que se abre sin sesión: la imagen de una campaña y la baja de los
 * comunicados (la baja va firmada, `utils/unsubscribe.ts`), y la configuración
 * pública que lee la SPA.
 */
export const publicRouter = Router();

publicRouter.get('/config', getPublicConfig);
publicRouter.get('/campaigns/:id/image', getCampaignImage);
publicRouter.get('/unsubscribe', unsubscribePage);
publicRouter.post('/unsubscribe', unsubscribe);

export default publicRouter;
