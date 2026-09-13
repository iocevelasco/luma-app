/**
 * Tipos compartidos entre la API y el frontend.
 *
 * Acá sólo vive lo que ambos lados necesitan hablar: sesión, usuario y el sobre
 * de respuesta de la API. El dominio del producto no pertenece a este paquete
 * hasta que dos paquetes lo necesiten al mismo tiempo.
 */

export type UserRole = 'admin' | 'user';

export type AccountStatus = 'active' | 'inactive';

/** Payload del access token. Lo firma la API y lo lee el middleware de auth. */
export interface JWTPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  /** Sólo presente en el refresh token. */
  type?: 'refresh';
  iat?: number;
  exp?: number;
}

/** Sobre uniforme de la API. El errorHandler garantiza esta forma también en los errores. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: unknown;
  code?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  email_verified: boolean;
  account_status: AccountStatus;
}

export interface LoginCredentials {
  email: string;
  password: string;
  recaptchaToken?: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  recaptchaToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
  recaptchaToken?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface SetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeEmailRequest {
  newEmail: string;
  password: string;
}

/** Lo que devuelve `POST /api/auth/login` y `POST /api/auth/refresh`. */
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

/** Lo que devuelve `GET /api/auth/me`. */
export interface AuthUserResponse {
  user: AuthUser;
}

export * from './project.js';
