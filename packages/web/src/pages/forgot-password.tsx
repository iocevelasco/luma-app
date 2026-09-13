import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';

type ForgotForm = z.infer<typeof forgotPasswordRequestSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotPasswordRequestSchema) });

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.forgotPassword.title')}</CardTitle>
          <CardDescription>{t('auth.forgotPassword.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => forgot.mutate(values.email))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <Button type="submit" disabled={forgot.isPending}>
              {forgot.isPending ? t('common.loading') : t('auth.forgotPassword.submit')}
            </Button>

            <p className="text-center text-sm">
              <Link className="text-muted-foreground hover:underline" to={ROUTES.LOGIN}>
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
