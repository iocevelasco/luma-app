import cookieParser from 'cookie-parser';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  changeEmail,
  changePassword,
  confirmEmailChange,
  forgotPassword,
  getCurrentUser,
  login,
  logout,
  refreshToken,
  register,
  resendVerification,
  resetPassword,
  setPassword,
  verifyEmail,
} from '../controllers/index.js';

export const authRouter = Router();

/**
 * Rate limit sólo en producción: en desarrollo los tests E2E hacen decenas de
 * logins seguidos y se comerían la ventana entera. El `trust proxy` se configura
 * en index.ts — sin eso, detrás de Traefik todos los clientes comparten IP.
 */
const authLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: 'Demasiados intentos. Probá de nuevo en unos minutos.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

authRouter.use(cookieParser());

authRouter.post('/login', authLimiter, login);
authRouter.post('/register', authLimiter, register);
authRouter.post('/refresh', authLimiter, refreshToken);
authRouter.post('/logout', isAuthenticated, logout);
authRouter.get('/me', isAuthenticated, getCurrentUser);

authRouter.post('/forgot-password', authLimiter, forgotPassword);
authRouter.post('/reset-password', authLimiter, resetPassword);
authRouter.post('/set-password', authLimiter, setPassword);

authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', authLimiter, resendVerification);

authRouter.post('/change-password', isAuthenticated, changePassword);
authRouter.post('/change-email', isAuthenticated, changeEmail);
authRouter.get('/confirm-email-change', confirmEmailChange);

export default authRouter;
