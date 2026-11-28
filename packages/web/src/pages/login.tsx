import { zodResolver } from '@hookform/resolvers/zod';
import { loginCredentialsSchema } from '@luma/shared';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { GoogleAuthSection } from '@/components/auth/google-auth-section';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLinkGoogle, useLogin } from '@/hooks/auth/use-auth-queries';
import { usePublicConfig } from '@/hooks/public-config/use-public-config';
import { isApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { ROUTES } from '@/lib/routes';
import { toast } from '@/lib/toast';

type LoginForm = z.infer<typeof loginCredentialsSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();
  const { data: publicConfig } = usePublicConfig();
  const googleEnabled = Boolean(publicConfig?.googleLogin);
  const linkGoogle = useLinkGoogle();
  // Tras un `GOOGLE_LINK_REQUIRED`: si entra ahora con su contraseña, se
  // conecta ese Google sin pasar por la cuenta. Sólo en memoria.
  const [pendingGoogle, setPendingGoogle] = useState<string | null>(null);

  const submit = async (values: LoginForm) => {
    if (!pendingGoogle) {
      login.mutate(values);
      return;
    }
    try {
      await login.mutateAsync(values);
    } catch {
      return; // Lo muestra el banner del formulario.
    }
    const credential = pendingGoogle;
    setPendingGoogle(null);
    // La pantalla ya navegó: el aviso de una falla va por toast.
    linkGoogle
      .mutateAsync({ credential, password: values.password })
      .catch((error: unknown) => toast.error(errorMessage(error, t) ?? t('errors.internal')));
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginCredentialsSchema) });

  return (
    <AuthSplitLayout width="sm">
      <AuthHeader align="start" title={t('auth.login.title')} />

      {/*
        Google primero: es la entrada más corta. Sin Google configurado no se
        dibuja ni el botón ni el divisor, y queda sólo la contraseña.
      */}
      {googleEnabled && (
        <div className="flex flex-col gap-6">
          <GoogleAuthSection text="signin_with" onLinkRequired={setPendingGoogle} />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            <span>{t('auth.login.orEmail')}</span>
            <Separator className="flex-1" />
          </div>
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit(submit)}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t('common.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('common.password')}</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p role="alert" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
          <Link
            className="self-end text-sm text-muted-foreground hover:text-foreground hover:underline"
            to={ROUTES.FORGOT_PASSWORD}
          >
            {t('auth.login.forgot')}
          </Link>
        </div>

        {login.isError && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-sm text-destructive">{errorMessage(login.error, t)}</p>
            {/*
              Una cuenta creada por invitación y sin activar recibe el mismo 401
              que una contraseña mal puesta (el servidor no puede distinguirlas
              sin delatar qué correos están registrados). La pista va acá, en
              el cliente, para quien llegó por una invitación.
            */}
            {isApiError(login.error) && login.error.status === 401 && (
              <p className="text-sm text-muted-foreground">
                {t('auth.login.pendingHint')}{' '}
                <Link className="text-primary hover:underline" to={ROUTES.CHECK_EMAIL}>
                  {t('auth.login.pendingAction')}
                </Link>
              </p>
            )}
            {/*
              Quien conectó Google con un Gmail pudo quedarse sin contraseña
              (ADR-005 §1, cuarta ronda) y la sigue escribiendo. El servidor no
              puede decirlo sin delatar qué cuentas existen: la pista va igual
              para todos, y sólo si el botón de Google está.
            */}
            {isApiError(login.error) && login.error.status === 401 && googleEnabled && (
              <p className="text-sm text-muted-foreground">{t('auth.login.googleHint')}</p>
            )}
          </div>
        )}

        {/* Entrar es la acción de la pantalla: el único verde. Crear cuenta va de contorno. */}
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? t('common.loading') : t('auth.login.submit')}
        </Button>
      </form>

      {/* Crear cuenta: un botón a la vista, no un enlace perdido en el encabezado. */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">{t('auth.cta.manageQuestion')}</p>
        <Button asChild variant="outline" size="lg" className="w-full">
          <Link to={ROUTES.REGISTER}>
            <UserPlus aria-hidden="true" className="text-primary" />
            {t('auth.cta.manageAction')}
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('auth.cta.invitedQuestion')}{' '}
        <Link className="text-foreground underline-offset-4 hover:underline" to={ROUTES.CHECK_EMAIL}>
          {t('auth.cta.invitedAction')}
        </Link>
      </p>
    </AuthSplitLayout>
  );
}

export default LoginPage;
