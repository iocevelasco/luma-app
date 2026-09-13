import type {
  ApiResponse,
  AuthResponse,
  AuthUser,
  ChangeEmailRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordRequest,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/**
 * Capa 1: funciones que hablan con la API y lanzan si falla.
 *
 * Los componentes nunca importan esto ni `apiClient`: consumen los hooks de
 * `src/hooks/auth`, que le agregan caché, deduplicación y estados de carga.
 *
 * Todo lo que se usa en una pantalla pública va con `skipAuth: true`: sin eso un
 * 401 dispara `handleUnauthorized` y patea a /login desde, por ejemplo,
 * /reset-password.
 *
 * `apiClient` devuelve el sobre entero (`{ success, data, message }`). El
 * desempaquetado se hace acá y no en los hooks: así el resto de la app trabaja
 * con el dato y no con la forma del transporte.
 */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

/** Endpoints que sólo devuelven un mensaje: el dato está en `message`. */
async function unwrapMessage(request: Promise<ApiResponse<unknown>>): Promise<string> {
  const response = await request;
  if (!response.success) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.message ?? '';
}
export const authApi = {
  login: (credentials: LoginCredentials) =>
    unwrap<AuthResponse>(
      apiClient.post('/api/auth/login', credentials, { skipAuth: true }),
    ),

  register: (credentials: RegisterCredentials) =>
    unwrap<{ user: AuthUser }>(
      apiClient.post('/api/auth/register', credentials, { skipAuth: true }),
    ),

  logout: () => unwrapMessage(apiClient.post('/api/auth/logout', {})),

  me: () => unwrap<{ user: AuthUser }>(apiClient.get('/api/auth/me')),

  forgotPassword: (payload: ForgotPasswordRequest) =>
    unwrapMessage(apiClient.post('/api/auth/forgot-password', payload, { skipAuth: true })),

  resetPassword: (payload: ResetPasswordRequest) =>
    unwrapMessage(apiClient.post('/api/auth/reset-password', payload, { skipAuth: true })),

  setPassword: (payload: ResetPasswordRequest) =>
    unwrap<AuthResponse>(
      apiClient.post('/api/auth/set-password', payload, { skipAuth: true }),
    ),

  verifyEmail: (token: string) =>
    unwrapMessage(
      apiClient.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
        skipAuth: true,
      }),
    ),

  resendVerification: (email: string) =>
    unwrapMessage(
      apiClient.post('/api/auth/resend-verification', { email }, { skipAuth: true }),
    ),

  changePassword: (payload: ChangePasswordRequest) =>
    unwrapMessage(apiClient.post('/api/auth/change-password', payload)),

  changeEmail: (payload: ChangeEmailRequest) =>
    unwrapMessage(apiClient.post('/api/auth/change-email', payload)),

  confirmEmailChange: (token: string) =>
    unwrapMessage(
      apiClient.get(`/api/auth/confirm-email-change?token=${encodeURIComponent(token)}`, {
        skipAuth: true,
      }),
    ),
};
