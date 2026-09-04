import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BellIcon,
  BoxIcon,
  CalendarIcon,
  HomeIcon,
  LogOutIcon,
  MessageSquareIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import type { Permission } from '@luma/shared';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import { useSessionStore } from '@/stores/session-store';
import { useNotifications } from '@/hooks';
import { Badge, Button } from '@/components/ui';
import { ProjectSwitcher } from './project-switcher';

interface NavItem {
  to: string;
  label: string;
  short: string;
  icon: typeof HomeIcon;
  permission?: Permission;
  /** Los cinco destinos que van en la barra inferior del celular. */
  primary?: boolean;
}

/**
 * La navegación es UNA lista y se filtra por permiso.
 *
 * Escritorio y móvil leen de acá, así que no hay forma de que un rol vea el
 * ítem en la barra lateral y no en la inferior. `primary` marca lo que entra en
 * la barra del celular: cinco destinos como máximo, porque más no entran sin
 * volverse imposibles de tocar con una mano.
 */
const NAV: NavItem[] = [
  { to: ROUTES.HOME, label: 'Panel', short: 'Panel', icon: HomeIcon, primary: true },
  {
    to: ROUTES.PLANNING,
    label: 'Planificación',
    short: 'Semana',
    icon: CalendarIcon,
    primary: true,
  },
  { to: ROUTES.MATERIALS, label: 'Materiales', short: 'Material', icon: BoxIcon, primary: true },
  { to: ROUTES.PERSONNEL, label: 'Personal', short: 'Personal', icon: UsersIcon },
  {
    to: ROUTES.BUDGET,
    label: 'Presupuesto',
    short: 'Plata',
    icon: WalletIcon,
    permission: 'budget.view.full',
  },
  {
    to: ROUTES.CONTINGENCIES,
    label: 'Imprevistos',
    short: 'Imprev.',
    icon: TriangleAlertIcon,
    primary: true,
  },
  {
    to: ROUTES.ASSISTANT,
    label: 'Asistente',
    short: 'Chat',
    icon: MessageSquareIcon,
    permission: 'assistant.use',
    primary: true,
  },
  {
    to: ROUTES.TEAM,
    label: 'Equipo',
    short: 'Equipo',
    icon: UsersIcon,
    permission: 'members.manage',
  },
];

export function AppShell() {
  const { can, logout } = useAuth();
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();
  const { data: notifications } = useNotifications();

  const visible = NAV.filter((item) => !item.permission || can(item.permission));
  const primary = visible.filter((item) => item.primary).slice(0, 5);
  const unread = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Barra lateral — escritorio, para planificar y analizar (§8). */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
        <div className="border-b border-border p-4">
          <p className="text-lg font-semibold tracking-tight">Luma</p>
          <p className="text-xs text-muted-foreground">Gestión de obra</p>
        </div>
        <div className="border-b border-border p-3">
          <ProjectSwitcher />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === ROUTES.HOME}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-1 pb-2 text-xs text-muted-foreground">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void logout().then(() => navigate(ROUTES.LOGIN))}
          >
            <LogOutIcon className="h-4 w-4" aria-hidden />
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Encabezado móvil */}
        <header className="pt-safe sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <ProjectSwitcher compact />
          <button
            type="button"
            className="relative rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`}
          >
            <BellIcon className="h-5 w-5" aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
            )}
          </button>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* Barra inferior — la operación diaria es acá (§8: móvil primero). */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card lg:hidden">
          <ul className="flex">
            {primary.map((item) => (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.to === ROUTES.HOME}
                  className={({ isActive }) =>
                    cn(
                      'flex h-16 flex-col items-center justify-center gap-1 text-[11px]',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                    )
                  }
                >
                  <item.icon className="h-5 w-5" aria-hidden />
                  {item.short}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** Shell del cliente: sin navegación operativa, una sola pantalla (§2.4). */
export function ClientShell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);

  return (
    <div className="min-h-screen bg-background">
      <header className="pt-safe border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-semibold tracking-tight">Luma</p>
            <p className="text-xs text-muted-foreground">Seguimiento de tu obra</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="outline">{user?.name ?? user?.email}</Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Salir"
              onClick={() => void logout().then(() => navigate(ROUTES.LOGIN))}
            >
              <LogOutIcon className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
