import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/auth-layout';
import { PasswordForm } from '@/components/auth/password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.activate.title')}</CardTitle>
          <CardDescription>{t('auth.activate.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <PasswordForm
              submitLabel={t('auth.activate.submit')}
              isPending={setPassword.isPending}
              onSubmit={(password) => setPassword.mutate({ token, password })}
            />
          ) : (
            <p className="text-sm text-destructive">{t('auth.resetPassword.missingToken')}</p>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default ActivatePage;
