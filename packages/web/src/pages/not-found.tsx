import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{t('common.notFoundTitle')}</h1>
      <p className="max-w-sm text-muted-foreground">{t('common.notFoundBody')}</p>
      <Button asChild>
        <Link to={ROUTES.ADMIN}>{t('common.goHome')}</Link>
      </Button>
    </div>
  );
}

export default NotFoundPage;
