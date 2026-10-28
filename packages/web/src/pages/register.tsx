import { zodResolver } from '@hookform/resolvers/zod';
import { registerCredentialsSchema } from '@luma/shared';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/auth/password-input';
import { TermsDialog } from '@/components/legal/terms-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegister } from '@/hooks/auth/use-auth-queries';
import { errorMessage } from '@/lib/error-message';
import { ROUTES } from '@/lib/routes';

// `acceptedTerms` no es un campo del formulario: se acepta en el diálogo que
// se abre al enviar, y ahí se agrega al payload.
const registerFormSchema = registerCredentialsSchema
  .omit({ acceptedTerms: true })
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });

type RegisterForm = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const registerUser = useRegister();
  const [pending, setPending] = useState<RegisterForm | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerFormSchema) });

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.register.title')} description={t('auth.register.subtitle')} />
      <div>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(setPending)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('common.name')}</Label>
            <Input
              id="name"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...register('name')}
            />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t('common.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
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
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p role="alert" className="text-sm text-destructive">
                {t('auth.register.mismatch')}
              </p>
            )}
          </div>

          <div className="flex gap-3 rounded-md border border-border bg-card p-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t('legal.notice.title')}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('legal.notice.body')}{' '}
                <a
                  href={ROUTES.LEGAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {t('legal.notice.link')}
                </a>
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={registerUser.isPending}>
            {t('auth.register.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.register.hasAccount')}{' '}
            <Link className="text-primary hover:underline" to={ROUTES.LOGIN}>
              {t('auth.register.login')}
            </Link>
          </p>
        </form>

        <TermsDialog
          open={pending !== null}
          onCancel={() => {
            setPending(null);
            registerUser.reset();
          }}
          onAccept={() =>
            pending &&
            registerUser.mutate({
              name: pending.name,
              email: pending.email,
              password: pending.password,
              acceptedTerms: true,
            })
          }
          isPending={registerUser.isPending}
          error={errorMessage(registerUser.error, t)}
          confirmLabel={t('legal.dialog.confirmCreate')}
        />
      </div>
    </AuthSplitLayout>
  );
}

export default RegisterPage;
