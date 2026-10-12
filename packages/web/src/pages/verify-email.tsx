import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
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
    <AuthSplitLayout width="md">
      <AuthHeader
        title={
          isPending && token
              ? t('auth.verifyEmail.verifying')
              : isSuccess
                ? t('auth.verifyEmail.success')
                : t('auth.verifyEmail.error')
        }
      />
      <div className="flex justify-center">
          {(isSuccess || isError || !token) && (
            <Button asChild>
              <Link to={ROUTES.LOGIN}>{t('auth.verifyEmail.goToLogin')}</Link>
            </Button>
          )}
        </div>
    </AuthSplitLayout>
  );
}

export default VerifyEmailPage;
