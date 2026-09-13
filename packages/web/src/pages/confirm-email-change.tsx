import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirmEmailChange } from '@/hooks/auth/use-auth-queries';
import { ROUTES } from '@/lib/routes';

export function ConfirmEmailChangePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isPending, isSuccess } = useConfirmEmailChange(token);

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>
            {isPending && token
              ? t('auth.confirmEmailChange.verifying')
              : isSuccess
                ? t('auth.confirmEmailChange.success')
                : t('auth.confirmEmailChange.error')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={ROUTES.LOGIN}>{t('auth.verifyEmail.goToLogin')}</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default ConfirmEmailChangePage;
