import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
import { useResendVerification } from '@/hooks/auth/use-auth-queries';

export function CheckEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const resend = useResendVerification();

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.checkEmail.title')} description={t('auth.checkEmail.subtitle')} />
      <div className="flex justify-center">
          {email && (
            <Button
              variant="outline"
              disabled={resend.isPending}
              onClick={() => resend.mutate(email)}
            >
              {resend.isPending ? t('common.loading') : t('auth.checkEmail.resend')}
            </Button>
          )}
        </div>
    </AuthSplitLayout>
  );
}

export default CheckEmailPage;
