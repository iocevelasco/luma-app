import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordForm } from '@/components/auth/password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useResetPassword } from '@/hooks/auth/use-auth-queries';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const reset = useResetPassword();

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
          <CardDescription>{t('auth.resetPassword.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <PasswordForm
              submitLabel={t('auth.resetPassword.submit')}
              isPending={reset.isPending}
              onSubmit={(password) => reset.mutate({ token, password })}
            />
          ) : (
            <p className="text-sm text-destructive">{t('auth.resetPassword.missingToken')}</p>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
