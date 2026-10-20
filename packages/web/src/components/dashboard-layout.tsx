import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { AppLogo } from '@/components/app-logo';
import { DashboardBottomNav } from '@/components/dashboard/navigation/dashboard-bottom-nav';
import { DashboardRail } from '@/components/dashboard/navigation/dashboard-rail';
import { HeaderTitle } from '@/components/dashboard/navigation/page-header';
import {
  ProjectNavScroller,
  ProjectSidebar,
} from '@/components/dashboard/navigation/project-sidebar';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { UserMenu } from '@/components/dashboard/user-menu';
import { LanguageSelector } from '@/components/language-selector';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { ContentAreaContext } from '@/components/layout/content-area-context';
import { SubscriptionNotice } from '@/components/subscription/subscription-notice';

/**
 * Chrome del panel: header, navegación lateral en desktop, barra inferior en
 * mobile.
 *
 * Vive una sola vez, arriba del `Outlet`. Si cada página montara su propio
 * header, cambiar de sección lo desmontaría y volvería a montar en cada
 * navegación — y con él, cualquier provider que colgara de ahí.
 *
 * **La navegación lateral cambia según dónde estés.** Fuera de una obra es el
 * riel angosto de íconos (hoy, un solo destino). Adentro, el sidebar de la
 * obra con sus doce secciones. Antes esas secciones eran pestañas en el
 * header y no entraban: se partían en dos filas y se comían la cabecera.
 */
export function DashboardLayout() {
  const projectId = useCurrentProjectId();
  const insideProject = Boolean(projectId);
  const { pathname } = useLocation();
  // Mi cuenta: un formulario, más angosto que un listado.
  const narrow = pathname === ROUTES.ACCOUNT_SETTINGS || pathname === ROUTES.SUBSCRIPTION;
  // El resto va a todo el ancho y cada pantalla angosta su contenido por
  // dentro (ver `PageLayout`): así la barra de acciones queda en el mismo
  // lugar en todas, y el pie del alta de obra va de borde a borde.
  const wide = !narrow;

  // El que scrollea es `main`, no la ventana: al cambiar de pantalla el
  // navegador ya no vuelve arriba solo, y se entraba a la sección nueva a la
  // altura donde se había dejado la anterior.
  //
  // Salvo entre una pantalla y lo que cuelga de ella (`hitos` ↔ `hitos/nuevo`):
  // ahí el listado sigue montado abajo del `FormPanel`, y al cerrarlo la
  // persona tiene que volver al mismo lugar donde estaba.
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  useEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;
    const nested = pathname.startsWith(`${previous}/`) || previous.startsWith(`${pathname}/`);
    if (mainRef.current && !nested) mainRef.current.scrollTop = 0;
  }, [pathname]);

  // Los portales (dialog, select, toast) cuelgan de <body>: sin la clase ahí
  // abrirían oscuros arriba del contenido claro. Sale al desmontar, así login
  // y landing no se enteran.
  useEffect(() => {
    document.body.classList.add('surface-light');
    return () => document.body.classList.remove('surface-light');
  }, []);

  const [contentArea, setContentArea] = useState<HTMLDivElement | null>(null);

  return (
    <TooltipProvider delayDuration={300}>
      {/*
        La altura es la de la ventana y nada más scrollea que el contenido:
        header y navegación lateral quedan siempre en su lugar. Con
        `min-h-dvh` el que crecía y scrolleaba era el documento entero, y el
        header y el sidebar se iban con él.
        `h-screen` + `supports-[height:100dvh]:h-dvh`: en iOS `100vh` incluye
        la barra del navegador y dejaba parte del contenido tapada.
      */}
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground supports-[height:100dvh]:h-dvh">
        <header className="surface-dark flex h-14 bg-background text-foreground shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-3">
            <AppLogo />
            <HeaderTitle />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSelector />
            <NotificationCenter />
            <UserMenu />
          </div>
        </header>

        {/* Mobile: las secciones de la obra, como tira scrolleable. */}
        <div className="surface-dark contents">
          <ProjectNavScroller />
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="surface-dark contents">
            {insideProject ? <ProjectSidebar /> : <DashboardRail />}
          </div>
          {/*
            Área de trabajo en superficie clara (ver `.surface-light` en
            index.css). Sin ilustración de fondo: tablas y formularios
            necesitan un fondo liso para leerse.
          */}
          <div
            ref={setContentArea}
            className="surface-light relative min-w-0 flex-1 bg-background text-foreground"
          >
            {/*
              pb-20 en mobile sólo cuando la barra inferior está: adentro de
              una obra no se muestra (la navegación es la tira de arriba), y
              ese padding dejaría un hueco muerto al final de cada pantalla.
            */}
            <main
              ref={mainRef}
              className={cn(
                'relative h-full min-w-0 overflow-y-auto p-4 md:pb-4',
                insideProject ? 'pb-24' : 'pb-36 md:pb-28',
              )}
            >
              <div
                className={cn(
                  'relative',
                  !insideProject && 'mx-auto w-full',
                  !insideProject && !wide && 'max-w-2xl',
                )}
              >
                <ContentAreaContext.Provider value={contentArea}>
                  <SubscriptionNotice />
                  <Outlet />
                </ContentAreaContext.Provider>
              </div>
            </main>
          </div>
        </div>

        {!insideProject && (
          <div className="surface-dark contents">
            <DashboardBottomNav />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
