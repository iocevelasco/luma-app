import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordForm } from '@/components/auth/password-form';
import { useResetPassword } from '@/hooks/auth/use-auth-queries';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const reset = useResetPassword();

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.resetPassword.title')} description={t('auth.resetPassword.subtitle')} />
      <div>
          {token ? (
            <PasswordForm
              submitLabel={t('auth.resetPassword.submit')}
              isPending={reset.isPending}
              onSubmit={(password) => reset.mutate({ token, password })}
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">{t('auth.resetPassword.missingToken')}</p>
          )}
        </div>
    </AuthSplitLayout>
  );
}

export default ResetPasswordPage;
