import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVerifyEmail } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';

/**
 * La verificación la dispara la URL, no un click: por eso es `useQuery` y no
 * `useMutation`. React Query deduplica, así que el doble montaje de StrictMode
 * no consume el token dos veces.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isPending, isError, isSuccess } = useVerifyEmail(token);

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            {isPending && token
              ? t('auth.verifyEmail.verifying')
              : isSuccess
                ? t('auth.verifyEmail.success')
                : t('auth.verifyEmail.error')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isSuccess || isError || !token) && (
            <Button asChild>
              <Link to={ROUTES.LOGIN}>{t('auth.verifyEmail.goToLogin')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default VerifyEmailPage;
