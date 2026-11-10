import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/app-logo';
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
 * Marco de todas las pantallas de sesión.
 *
 * - Desde `lg`: la pantalla se parte en dos. A la izquierda la imagen
 *   (`hero-desktop`, 4:5), a la derecha el formulario flotando directo sobre
 *   fondo blanco, sin card.
 * - Debajo de `lg`: la imagen (`hero-mobile`, 16:9) ocupa todo el fondo y el
 *   formulario va en una card blanca encima.
 *
 * El panel del formulario es claro (`surface-light`) aunque el resto de la app
 * sea oscuro: re-define los tokens, así los inputs y textos salen bien sobre blanco.
 * Las imágenes llevan el texto horneado en el 60% central del ancho: el
 * `object-cover` recorta los costados, y el centro no se toca. Si regenerás una,
 * mantené esa zona segura. El panel derecho es el que scrollea, no la página.
 */
export function AuthSplitLayout({ children, width = 'sm' }: AuthSplitLayoutProps) {
  const { t } = useTranslation();
  const baseUrl = import.meta.env.BASE_URL;

  return (
    <div className="relative h-screen overflow-hidden bg-neutral-950 text-foreground supports-[height:100dvh]:h-dvh">
      {/* Fondo de imagen: sólo en mobile; en desktop la imagen vive en su propia mitad. */}
      <img
        src={`${baseUrl}auth/hero-mobile.webp`}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full object-cover object-center lg:hidden"
      />
      <div className="relative grid h-full lg:grid-cols-2">
        <aside className="relative hidden bg-white p-3 lg:block">
          <div className="relative h-full overflow-hidden rounded-2xl bg-secondary">
            {/* `lazy`: bajo `lg` el panel está oculto y así el navegador no la descarga. */}
            <img
              src={`${baseUrl}auth/hero-desktop.webp`}
              alt={t('auth.hero.imageAlt')}
              className="absolute inset-0 size-full object-cover object-center"
              loading="lazy"
            />
          </div>
        </aside>

        <main className="surface-light overflow-y-auto lg:bg-white">
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 sm:px-10 lg:py-10">
            <div
              className={cn(
                'flex w-full flex-col gap-6 rounded-3xl bg-white p-6 text-foreground shadow-[var(--shadow-surface)] sm:p-8',
                'lg:rounded-none lg:p-0 lg:shadow-none',
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
