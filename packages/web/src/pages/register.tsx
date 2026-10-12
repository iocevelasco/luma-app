import { zodResolver } from '@hookform/resolvers/zod';
import { registerCredentialsSchema } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/auth/password-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/auth/use-auth-queries';
import { errorMessage } from '@/lib/error-message';
import { ROUTES } from '@/lib/routes';

const registerFormSchema = registerCredentialsSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type RegisterForm = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const registerUser = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerFormSchema) });

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
            onSubmit={handleSubmit(({ confirmPassword: _confirm, ...values }) =>
              registerUser.mutate(values),
            )}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{t('auth.register.mismatch')}</p>
              )}
            </div>

            {registerUser.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(registerUser.error, t)}
              </p>
            )}

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
