import { useEffect, useRef } from 'react';
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
  // Formularios (alta de obra, Mi cuenta): más angostos que un listado.
  const narrow = [ROUTES.PROJECT_NEW, ROUTES.ACCOUNT_SETTINGS].some((path) => path === pathname);
  // El listado de obras usa todo el ancho: las cards crecen en columnas.
  const wide = pathname === ROUTES.ADMIN;

  // El que scrollea es `main`, no la ventana: al cambiar de pantalla el
  // navegador ya no vuelve arriba solo, y se entraba a la sección nueva a la
  // altura donde se había dejado la anterior.
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [pathname]);

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
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
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
        <ProjectNavScroller />

        <div className="flex min-h-0 flex-1">
          {insideProject ? <ProjectSidebar /> : <DashboardRail />}
          {/*
            La ilustración vive afuera del que scrollea: adentro se iría con
            el contenido en vez de quedarse en la esquina.

            Las vistas principales (Obras, Proveedores, Empleados, Nueva obra)
            la llevan y el contenido va centrado. Adentro de una obra no: ahí
            hay tablas y cronogramas que necesitan todo el ancho y un fondo
            que no compita. Va con opacidad baja: son líneas finas, y a todo
            color hacen ilegible el texto que cae encima.
          */}
          <div className="relative min-w-0 flex-1">
            {!insideProject && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[url('/illustrations/estructura.png')] bg-contain bg-right-bottom bg-no-repeat opacity-[0.14] dark:opacity-20"
              />
            )}
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
                  !insideProject && !wide && (narrow ? 'max-w-2xl' : 'max-w-4xl'),
                )}
              >
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        {!insideProject && <DashboardBottomNav />}
      </div>
    </TooltipProvider>
  );
}
