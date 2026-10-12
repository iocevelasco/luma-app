import { zodResolver } from '@hookform/resolvers/zod';
import { loginCredentialsSchema } from '@luma/shared';
import { ArrowRight, Building2, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useLogin } from '@/hooks/auth/use-auth-queries';
import { errorMessage } from '@/lib/error-message';
import { ROUTES } from '@/lib/routes';

type LoginForm = z.infer<typeof loginCredentialsSchema>;

export function LoginPage() {
  const { t } = useTranslation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginCredentialsSchema) });

  return (
    <AuthSplitLayout width="sm">
      <AuthHeader title={t('auth.login.title')} description={t('auth.login.subtitle')} />

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) => login.mutate(values))}
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
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(login.error, t)}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? t('common.loading') : t('auth.login.submit')}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Separator className="flex-1" />
        <span>{t('auth.or')}</span>
        <Separator className="flex-1" />
      </div>

      <div className="flex flex-col gap-3">
        <Button asChild variant="outline" size="lg" className="h-auto w-full justify-start py-3">
          <Link to={ROUTES.REGISTER}>
            <Building2 aria-hidden="true" />
            <span className="flex flex-1 flex-col items-start text-left">
              <span className="text-xs font-normal text-muted-foreground">
                {t('auth.cta.manageQuestion')}
              </span>
              <span className="font-semibold">{t('auth.cta.manageAction')}</span>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-auto w-full justify-start py-3">
          <Link to={ROUTES.CHECK_EMAIL}>
            <MailCheck aria-hidden="true" />
            <span className="flex flex-1 flex-col items-start text-left">
              <span className="text-xs font-normal text-muted-foreground">
                {t('auth.cta.invitedQuestion')}
              </span>
              <span className="font-semibold">{t('auth.cta.invitedAction')}</span>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </AuthSplitLayout>
  );
}

export default LoginPage;
