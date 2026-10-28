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
 * Marco de todas las pantallas de sesión: imagen a la izquierda (sólo ≥ lg) y
 * formulario a la derecha, sobre la grilla de fondo. Usa los tokens del tema vigente — no fuerza ningún
 * tema propio — y el panel derecho es el que scrollea, no la página.
 *
 * Son dos imágenes, no una recortada: `hero-desktop` (4:5) llena el panel y
 * `hero-mobile` (16:9) es el banner que va sobre la tarjeta por debajo de `lg`.
 * Las dos llevan el texto horneado en el 60% central del ancho: el `object-cover`
 * recorta los costados cuando el panel se angosta, y el centro no se toca. Si
 * regenerás una, mantené esa zona segura.
 */
export function AuthSplitLayout({ children, width = 'sm' }: AuthSplitLayoutProps) {
  const { t } = useTranslation();
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <div className="relative h-screen bg-background p-3 text-foreground supports-[height:100dvh]:h-dvh sm:p-4">
      <GridBackground size={4} opacity={0.02} />
      <div className="relative grid h-full overflow-hidden rounded-3xl text-card-foreground shadow-[var(--shadow-surface)] lg:grid-cols-2">
        <aside className="relative hidden bg-card p-3 lg:block">
          <div className="relative h-full overflow-hidden rounded-2xl bg-muted">
            {/* `lazy`: bajo `lg` el panel está oculto y así el navegador no la descarga. */}
            <img
              src={`${baseUrl}auth/hero-desktop.webp`}
              alt={t('auth.hero.imageAlt')}
              className="absolute inset-0 size-full object-cover object-center"
              loading="lazy"
            />
          </div>
        </aside>

        <main className="overflow-y-auto">
          <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-10 sm:px-10">
            <img
              src={`${baseUrl}auth/hero-mobile.webp`}
              alt={t('auth.hero.imageAlt')}
              width={1200}
              height={675}
              className={cn('aspect-video w-full rounded-2xl object-cover object-center lg:hidden', widths[width])}
            />
            {/* Card translúcida: deja asomar la textura sin que compita con el texto. */}
            <div
              className={cn(
                'flex w-full flex-col gap-6 rounded-3xl border border-border bg-card/70 p-6 sm:p-8',
                widths[width],
              )}
            >
              {children}
            </div>
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
