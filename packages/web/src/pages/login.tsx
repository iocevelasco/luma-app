import { zodResolver } from '@hookform/resolvers/zod';
import { loginCredentialsSchema } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin } from '@/hooks/auth/use-auth-queries';
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
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.login.title')}</CardTitle>
          <CardDescription>{t('auth.login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => login.mutate(values))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? t('common.loading') : t('auth.login.submit')}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <Link className="text-muted-foreground hover:underline" to={ROUTES.FORGOT_PASSWORD}>
                {t('auth.login.forgot')}
              </Link>
              <p className="text-muted-foreground">
                {t('auth.login.noAccount')}{' '}
                <Link className="text-primary hover:underline" to={ROUTES.REGISTER}>
                  {t('auth.login.register')}
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default LoginPage;
