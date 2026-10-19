import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { getMySubscription } from '../controllers/index.js';

/**
 * La suscripción de la Empresa a Luma. Sin `requireWritableSubscription` a
 * propósito: es justo por acá que alguien vencido tiene que poder pagar.
 */
export const subscriptionRouter = Router();

subscriptionRouter.get('/me', isAuthenticated, getMySubscription);

export default subscriptionRouter;
