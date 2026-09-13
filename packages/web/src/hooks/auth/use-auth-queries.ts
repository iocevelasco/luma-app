import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  ChangeEmailRequest,
  ChangePasswordRequest,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordRequest,
} from '@luma/shared';
import { authApi } from '@/api/auth';
import { isApiError } from '@/lib/api-client';
import { QueryKeys } from '@/lib/query-keys';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

/**
 * Capa 2: hooks de TanStack Query sobre `src/api/auth.ts`.
 *
 * `useQuery` para lecturas y efectos manejados por la URL; `useMutation` para
 * escrituras y acciones que dispara la persona. React Query deduplica por sí
 * solo, así que no hacen falta guardas manuales contra el doble montaje de
 * StrictMode.
 */

function errorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) return error.message;
  return error instanceof Error ? error.message : fallback;
}

/** El perfil del usuario logueado. */
export function useCurrentUser() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [QueryKeys.currentUser],
    queryFn: () => authApi.me(),
    // Obligatorio en toda query protegida: los providers corren también en las
    // pantallas públicas, y un 401 ahí patea a /login y rompe el flujo.
    enabled: isAuthenticated,
  });
}

export function useLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      login(data.accessToken, data.user);
      navigate(ROUTES.ADMIN);
    },
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.login'))),
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => authApi.register(credentials),
    onSuccess: () => navigate(ROUTES.CHECK_EMAIL),
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.register'))),
  });
}

export function useLogout() {
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    // Pase lo que pase con la request, la sesión local se cierra: dejar al
    // usuario "adentro" porque el servidor no respondió es peor que cerrarla.
    onSettled: () => {
      queryClient.clear();
      logout();
    },
  });
}

export function useForgotPassword() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword({ email }),
    onSuccess: () => toast.success(t('auth.forgotPassword.sent')),
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) => authApi.resetPassword(payload),
    onSuccess: () => {
      toast.success(t('auth.resetPassword.done'));
      navigate(ROUTES.LOGIN);
    },
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}

/** Activación: primera contraseña. Deja la sesión abierta al terminar. */
export function useSetPassword() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ResetPasswordRequest) => authApi.setPassword(payload),
    onSuccess: (data) => {
      login(data.accessToken, data.user);
      navigate(ROUTES.ADMIN);
    },
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}

/** Verificación de email: la dispara la URL, no la persona. De ahí el useQuery. */
export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: [QueryKeys.emailVerification, token],
    queryFn: () => authApi.verifyEmail(token!),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

export function useConfirmEmailChange(token: string | null) {
  return useQuery({
    queryKey: [QueryKeys.emailVerification, 'change', token],
    queryFn: () => authApi.confirmEmailChange(token!),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
}

export function useResendVerification() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => toast.success(t('auth.checkEmail.resent')),
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}

export function useChangePassword() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => authApi.changePassword(payload),
    onSuccess: () => toast.success(t('auth.account.passwordChanged')),
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}

export function useChangeEmail() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ChangeEmailRequest) => authApi.changeEmail(payload),
    onSuccess: () => toast.success(t('auth.account.emailChangeSent')),
    onError: (error) => toast.error(errorMessage(error, t('auth.errors.generic'))),
  });
}
