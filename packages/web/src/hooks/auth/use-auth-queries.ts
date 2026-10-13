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
import { errorMessage } from '@/lib/error-message';
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

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: (data) => {
      login(data.accessToken, data.user);
      navigate(ROUTES.ADMIN);
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => authApi.register(credentials),
    // Con la verificación apagada la cuenta nace verificada: se entra directo.
    // El correo viaja en el estado del router y no en la URL: así `check-email`
    // ya sabe a quién reenviar sin pedírselo de nuevo, y la dirección no queda
    // en el historial ni en los logs de un proxy.
    onSuccess: (data, credentials) =>
      data.user.email_verified
        ? navigate(ROUTES.LOGIN)
        : navigate(ROUTES.CHECK_EMAIL, { state: { email: credentials.email } }),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
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
    onError: (error) => toast.error(errorMessage(error, t)),
  });
}

export function useChangePassword() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ChangePasswordRequest) => authApi.changePassword(payload),
    onSuccess: () => toast.success(t('auth.account.passwordChanged')),
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}

export function useChangeEmail() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ChangeEmailRequest) => authApi.changeEmail(payload),
    onSuccess: () => toast.success(t('auth.account.emailChangeSent')),
      // Sin `onError`: esta mutación se envía desde un formulario y el banner
      // de `FormShell` muestra la falla ahí mismo. Un toast sería el mismo
      // mensaje dos veces, en dos lugares distintos de la pantalla.
  });
}
