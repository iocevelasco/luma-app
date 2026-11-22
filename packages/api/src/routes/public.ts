import { createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getCalendarFeed,
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

/**
 * El feed de calendario se limita **por token** y no por IP: los recolectores
 * de Google Calendar comparten IP, y un límite por IP los frenaría a todos. La
 * defensa contra adivinar la URL es la entropía del token, no este límite.
 * La clave es un hash: el token no queda en la memoria del limitador.
 */
const calendarFeedLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 30,
        keyGenerator: (req) =>
          `calendar:${createHash('sha256').update(String(req.params.token ?? '')).digest('hex')}`,
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

publicRouter.get('/config', getPublicConfig);
publicRouter.get('/calendar/:token.ics', calendarFeedLimiter, getCalendarFeed);
publicRouter.get('/campaigns/:id/image', getCampaignImage);
publicRouter.get('/unsubscribe', unsubscribePage);
publicRouter.post('/unsubscribe', unsubscribe);

export default publicRouter;
