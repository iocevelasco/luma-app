import { zodResolver } from '@hookform/resolvers/zod';
import { registerCredentialsSchema } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';

type RegisterForm = z.infer<typeof registerCredentialsSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerCredentialsSchema) });

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => registerUser.mutate(values))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={registerUser.isPending}>
              {registerUser.isPending ? t('common.loading') : t('auth.register.submit')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t('auth.register.hasAccount')}{' '}
              <Link className="text-primary hover:underline" to={ROUTES.LOGIN}>
                {t('auth.register.login')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default RegisterPage;
