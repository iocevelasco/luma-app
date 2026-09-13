import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useResendVerification } from '@/hooks/auth/use-auth-queries';

export function CheckEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const resend = useResendVerification();

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.checkEmail.title')}</CardTitle>
          <CardDescription>{t('auth.checkEmail.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {email && (
            <Button
              variant="outline"
              disabled={resend.isPending}
              onClick={() => resend.mutate(email)}
            >
              {resend.isPending ? t('common.loading') : t('auth.checkEmail.resend')}
            </Button>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export default CheckEmailPage;
