import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
import { useConfirmEmailChange } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';

export function ConfirmEmailChangePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isPending, isSuccess } = useConfirmEmailChange(token);

  return (
    <AuthSplitLayout width="md">
      <AuthHeader
        title={
          isPending && token
              ? t('auth.confirmEmailChange.verifying')
              : isSuccess
                ? t('auth.confirmEmailChange.success')
                : t('auth.confirmEmailChange.error')
        }
      />
      <div className="flex justify-center">
          <Button asChild>
            <Link to={ROUTES.LOGIN}>{t('auth.verifyEmail.goToLogin')}</Link>
          </Button>
        </div>
    </AuthSplitLayout>
  );
}

export default ConfirmEmailChangePage;
