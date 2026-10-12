import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { PasswordForm } from '@/components/auth/password-form';
import { useSetPassword } from '@/hooks/auth/use-auth-queries';

/**
 * Activación: la cuenta la creó un admin y todavía no tiene contraseña. Al
 * terminar deja la sesión abierta — pedirle a la persona que vuelva a entrar
 * justo después de elegir su contraseña no agrega seguridad, sólo fricción.
 */
export function ActivatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const setPassword = useSetPassword();

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.activate.title')} description={t('auth.activate.subtitle')} />
      <div>
          {token ? (
            <PasswordForm
              submitLabel={t('auth.activate.submit')}
              isPending={setPassword.isPending}
              onSubmit={(password) => setPassword.mutate({ token, password })}
            />
          ) : (
            <p role="alert" className="text-sm text-destructive">{t('auth.resetPassword.missingToken')}</p>
          )}
        </div>
    </AuthSplitLayout>
  );
}

export default ActivatePage;
