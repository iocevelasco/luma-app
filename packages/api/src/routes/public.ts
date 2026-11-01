import { Router } from 'express';
import {
  getCampaignImage,
  unsubscribe,
  unsubscribePage,
} from '../controllers/index.js';

/**
 * Lo que un cliente de correo abre sin sesión: la imagen de una campaña y la
 * baja de los comunicados. La baja va firmada (`utils/unsubscribe.ts`).
 */
export const publicRouter = Router();

publicRouter.get('/campaigns/:id/image', getCampaignImage);
publicRouter.get('/unsubscribe', unsubscribePage);
publicRouter.post('/unsubscribe', unsubscribe);

export default publicRouter;
