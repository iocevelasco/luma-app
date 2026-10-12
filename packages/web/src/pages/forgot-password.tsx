import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
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
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.forgotPassword.title')} description={t('auth.forgotPassword.subtitle')} />
      <div>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => forgot.mutate(values.email))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? t('common.loading') : t('auth.forgotPassword.submit')}
            </Button>

            <p className="text-center text-sm">
              <Link className="text-muted-foreground hover:underline" to={ROUTES.LOGIN}>
                {t('auth.forgotPassword.backToLogin')}
              </Link>
            </p>
          </form>
        </div>
    </AuthSplitLayout>
  );
}

export default ForgotPasswordPage;
