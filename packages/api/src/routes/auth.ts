import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import { isProduction } from '../config/app.config.js';
import * as auth from '../controllers/auth.controller.js';

export const authRouter = Router();

/**
 * Rate limit sólo en producción: en desarrollo y en los tests E2E, 10 intentos
 * por ventana se agotan en el primer recorrido y el error que ve el
 * desarrollador no tiene nada que ver con lo que rompió.
 */
const authLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Demasiados intentos. Probá de nuevo en un rato.' },
    })
  : (_req: unknown, _res: unknown, next: () => void) => next();

authRouter.post('/register', authLimiter, asyncHandler(auth.register));
authRouter.post('/login', authLimiter, asyncHandler(auth.login));
authRouter.post('/refresh', asyncHandler(auth.refresh));
authRouter.post('/logout', asyncHandler(auth.logout));

authRouter.post('/forgot-password', authLimiter, asyncHandler(auth.forgotPassword));
authRouter.post('/reset-password', authLimiter, asyncHandler(auth.resetPassword));
authRouter.post('/activate', authLimiter, asyncHandler(auth.activateAccount));
authRouter.post('/verify-email', authLimiter, asyncHandler(auth.verifyEmail));

authRouter.get('/me', isAuthenticated, asyncHandler(auth.me));
authRouter.post('/switch-project', isAuthenticated, asyncHandler(auth.switchProject));
authRouter.post('/resend-verification', isAuthenticated, asyncHandler(auth.resendVerification));
authRouter.post('/change-password', isAuthenticated, asyncHandler(auth.changePassword));
authRouter.patch('/profile', isAuthenticated, asyncHandler(auth.updateProfile));
