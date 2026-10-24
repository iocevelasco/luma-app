import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/app-logo';
import { GridBackground } from '@/components/grid-background';
import { cn } from '@/lib/utils';

type AuthWidth = 'sm' | 'md' | 'lg';

interface AuthSplitLayoutProps {
  children: ReactNode;
  /** Ancho de la columna del formulario: sm = login, md = formularios largos, lg = listados. */
  width?: AuthWidth;
}

const widths: Record<AuthWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/**
 * Marco de todas las pantallas de sesión: foto a la izquierda (sólo ≥ lg) y
 * formulario a la derecha, sobre la grilla de fondo. Usa los tokens del tema vigente — no fuerza ningún
 * tema propio — y el panel derecho es el que scrollea, no la página.
 */
export function AuthSplitLayout({ children, width = 'sm' }: AuthSplitLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="relative h-screen bg-background p-3 text-foreground supports-[height:100dvh]:h-dvh sm:p-4">
      <GridBackground size={12} opacity={0.035} />
      <div className="relative grid h-full overflow-hidden rounded-3xl text-card-foreground shadow-[var(--shadow-surface)] lg:grid-cols-2">
        <aside className="relative hidden bg-card p-3 lg:block">
          <div className="relative h-full overflow-hidden rounded-2xl bg-muted">
            <img
              src={`${import.meta.env.BASE_URL}auth/hero.jpg`}
              alt={t('auth.hero.imageAlt')}
              className="absolute inset-0 size-full object-cover object-center"
              fetchPriority="high"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-8">
              <p className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                {t('auth.hero.title')}
              </p>
              <p className="text-sm text-muted-foreground">{t('auth.hero.subtitle')}</p>
            </div>
          </div>
        </aside>

        <main className="overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-6 py-10 sm:px-10">
            <div className={cn('flex w-full flex-col gap-6', widths[width])}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

interface AuthHeaderProps {
  title: string;
  description?: string;
}

/** Logo, título y subtítulo centrados: la cabecera común de cada pantalla. */
export function AuthHeader({ title, description }: AuthHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <AppLogo size="lg" />
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  );
}
