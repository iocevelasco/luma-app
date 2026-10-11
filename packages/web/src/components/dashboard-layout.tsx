import { Outlet } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo';
import { DashboardBottomNav } from '@/components/dashboard/navigation/dashboard-bottom-nav';
import { DashboardRail } from '@/components/dashboard/navigation/dashboard-rail';
import { Breadcrumbs } from '@/components/dashboard/navigation/breadcrumbs';
import { ProjectTabs } from '@/components/dashboard/navigation/project-tabs';
import { UserMenu } from '@/components/dashboard/user-menu';
import { LanguageSelector } from '@/components/language-selector';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Chrome del panel: header, riel en desktop, barra inferior en mobile.
 *
 * Vive una sola vez, arriba del `Outlet`. Si cada página montara su propio
 * header, cambiar de sección lo desmontaría y volvería a montar en cada
 * navegación — y con él, cualquier provider que colgara de ahí.
 */
export function DashboardLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <AppLogo />
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            <ProjectTabs />
            <LanguageSelector />
            <UserMenu />
          </div>
        </header>

        <div className="flex flex-1">
          <DashboardRail />
          {/* pb-16 en mobile: la barra inferior es fija y taparía el final. */}
          <main className="min-w-0 flex-1 p-4 pb-20 md:pb-4">
            <Outlet />
          </main>
        </div>

        <DashboardBottomNav />
      </div>
    </TooltipProvider>
  );
}
