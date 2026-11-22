import cookieParser from 'cookie-parser';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  acceptTerms,
  changeEmail,
  changePassword,
  confirmEmailChange,
  forgotPassword,
  getCurrentUser,
  googleAuth,
  linkGoogle,
  login,
  logout,
  refreshToken,
  register,
  resendVerification,
  resetPassword,
  setPassword,
  unlinkGoogle,
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
        message: 'Demasiados intentos. Prueba de nuevo en unos minutos.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Conectar y desconectar Google piden la contraseña: sin un tope por cuenta,
 * quien robó una sesión abierta la prueba por fuerza bruta. Por cuenta y no
 * por IP, porque ya hay sesión.
 */
const googleLinkLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        keyGenerator: (req) => `google-link:${req.user?.sub ?? 'anon'}`,
        message: 'Demasiados intentos. Prueba de nuevo en unos minutos.',
        standardHeaders: true,
        legacyHeaders: false,
      })
    : (_req: Request, _res: Response, next: NextFunction) => next();

authRouter.use(cookieParser());

authRouter.post('/login', authLimiter, login);
authRouter.post('/register', authLimiter, register);
// Sin reCAPTCHA: la credencial de Google ya prueba que hay una persona del otro lado.
authRouter.post('/google', authLimiter, googleAuth);
authRouter.post('/google/link', isAuthenticated, googleLinkLimiter, linkGoogle);
authRouter.delete('/google/link', isAuthenticated, googleLinkLimiter, unlinkGoogle);
authRouter.post('/refresh', authLimiter, refreshToken);
authRouter.post('/logout', isAuthenticated, logout);
authRouter.get('/me', isAuthenticated, getCurrentUser);
authRouter.post('/accept-terms', isAuthenticated, acceptTerms);

authRouter.post('/forgot-password', authLimiter, forgotPassword);
authRouter.post('/reset-password', authLimiter, resetPassword);
authRouter.post('/set-password', authLimiter, setPassword);

authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', authLimiter, resendVerification);

authRouter.post('/change-password', isAuthenticated, changePassword);
authRouter.post('/change-email', isAuthenticated, changeEmail);
authRouter.get('/confirm-email-change', confirmEmailChange);

export default authRouter;
