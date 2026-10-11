import { Outlet } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo';
import { DashboardBottomNav } from '@/components/dashboard/navigation/dashboard-bottom-nav';
import { DashboardRail } from '@/components/dashboard/navigation/dashboard-rail';
import { Breadcrumbs } from '@/components/dashboard/navigation/breadcrumbs';
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-3">
            <AppLogo />
            <Breadcrumbs />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSelector />
            <NotificationCenter />
            <UserMenu />
          </div>
        </header>

        {/* Mobile: las secciones de la obra, como tira scrolleable. */}
        <ProjectNavScroller />

        <div className="flex flex-1">
          {insideProject ? <ProjectSidebar /> : <DashboardRail />}
          {/*
            pb-20 en mobile sólo cuando la barra inferior está: adentro de una
            obra no se muestra (la navegación es la tira de arriba), y ese
            padding dejaría un hueco muerto al final de cada pantalla.
          */}
          <main className={cn('min-w-0 flex-1 p-4 md:pb-4', insideProject ? 'pb-4' : 'pb-20')}>
            <Outlet />
          </main>
        </div>

        {!insideProject && <DashboardBottomNav />}
      </div>
    </TooltipProvider>
  );
}
