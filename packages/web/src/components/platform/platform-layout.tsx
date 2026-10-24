import { useEffect, useRef } from 'react';
import { ArrowLeft, Landmark, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo';
import { LanguageSelector } from '@/components/language-selector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SECTIONS: { to: string; key: 'users' | 'billing'; icon: LucideIcon }[] = [
  { to: ROUTES.PLATFORM_USERS, key: 'users', icon: Users },
  { to: ROUTES.PLATFORM_BILLING, key: 'billing', icon: Landmark },
];

/**
 * Chrome de la administración global de Luma. Es otra cosa que el panel: no
 * hay obras, ni riel, ni campana, ni avisos de la suscripción de la Empresa.
 * Lo usa quien opera la plataforma, no quien gestiona sus obras, así que ni
 * comparte la navegación ni se mezcla con ella.
 *
 * Los guards (sesión y `role: 'admin'`) van arriba, en `routes.tsx`; acá sólo
 * se dibuja. La única salida es "Volver a la app".
 */
export function PlatformLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const section = SECTIONS.find((item) => item.to === pathname);

  // Mismo criterio que el panel: scrollea `main`, no la ventana, y al cambiar
  // de sección se vuelve arriba.
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

  // Los portales (dialog, select, toast) cuelgan de <body>: sin la clase ahí
  // abrirían oscuros arriba del contenido claro.
  useEffect(() => {
    document.body.classList.add('surface-light');
    return () => document.body.classList.remove('surface-light');
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-dvh">
        <div className="surface-dark shrink-0 border-b border-border bg-background text-foreground">
          <header className="flex h-14 items-center justify-between gap-4 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <AppLogo />
              <Badge variant="outline">{t('platform.layout.badge')}</Badge>
              {section && (
                <h1 className="min-w-0 truncate border-l border-border pl-3 font-serif text-2xl leading-none tracking-tight">
                  {t(`platform.nav.${section.key}`)}
                </h1>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSelector />
              <Button asChild variant="ghost" size="sm">
                <Link to={ROUTES.ADMIN}>
                  <ArrowLeft className="size-4" />
                  {t('platform.layout.back')}
                </Link>
              </Button>
            </div>
          </header>
          <nav
            aria-label={t('platform.layout.navLabel')}
            className="flex gap-1 overflow-x-auto px-4 pb-2"
          >
            {SECTIONS.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'bg-foreground/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {t(`platform.nav.${key}`)}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="surface-light min-h-0 flex-1 bg-background text-foreground">
          <main ref={mainRef} className="mx-auto h-full w-full min-w-0 overflow-y-auto p-4 pb-12">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default PlatformLayout;
