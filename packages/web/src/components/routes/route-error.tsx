import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/lib/routes';
import { useHardSignOut } from '@/hooks/auth/use-hard-sign-out';

interface RouteErrorProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

/**
 * Error component for route errors
 */
export function RouteError({ error, resetErrorBoundary }: RouteErrorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, isPending } = useHardSignOut();

  useEffect(() => {
    // Log error for debugging
    if (error) {
      console.error('[Route Error]', error);
    }
  }, [error]);

  const handleGoHome = () => {
    navigate(ROUTES.ADMIN);
    resetErrorBoundary?.();
  };

  const handleRetry = () => {
    resetErrorBoundary?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle>{t('routeError.title')}</CardTitle>
          </div>
          <CardDescription>{t('routeError.description')}</CardDescription>
        </CardHeader>
        {error && (
          <CardContent>
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-mono text-muted-foreground break-all">
                {error.message || t('routeError.unknown')}
              </p>
            </div>
          </CardContent>
        )}
        <CardFooter className="flex flex-col gap-3">
          <div className="flex w-full gap-2">
            <Button onClick={handleRetry} variant="outline" className="flex-1">
              {t('routeError.retry')}
            </Button>
            <Button onClick={handleGoHome} className="flex-1">
              {t('routeError.goHome')}
            </Button>
          </div>

          {/*
            Última salida, separada de las otras dos: si lo que rompe es la
            sesión —token viejo, usuario cacheado con una forma que el código
            nuevo no entiende— reintentar e ir al inicio vuelven a fallar, y
            sin esto el usuario queda encerrado en la pantalla de error.
          */}
          <Button
            onClick={signOut}
            disabled={isPending}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {t('routeError.signOut')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
