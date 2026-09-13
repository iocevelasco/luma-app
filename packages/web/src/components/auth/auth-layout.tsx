import type { ReactNode } from 'react';
import { AppLogo } from '@/components/app-logo';
import { GridBackground } from '@/components/grid-background';

interface AuthLayoutProps {
  children: ReactNode;
  /** Línea corta sobre la tarjeta, opcional. */
  tagline?: string;
}

/**
 * Chrome de las pantallas de sesión. Fuerza el tema oscuro con la clase `dark`
 * en su contenedor: estas pantallas no dependen de la preferencia guardada
 * porque se ven antes de que haya sesión (y antes de que haya preferencia).
 */
export function AuthLayout({ children, tagline }: AuthLayoutProps) {
  return (
    <div className="dark relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <GridBackground />

      <div className="absolute inset-x-0 top-0 h-px bg-primary" aria-hidden="true" />

      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--color-primary) 10%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 py-12">
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex flex-col items-center gap-2">
            <AppLogo size="lg" />
            {tagline && (
              <p className="text-center font-mono text-xs uppercase tracking-[0.18em] text-primary">
                {tagline}
              </p>
            )}
          </div>
          {children}
        </div>
      </div>

      <footer className="relative z-10 border-t border-border px-6 py-4 text-center">
        <span className="font-mono text-xs text-muted-foreground">
          Luma · {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}
