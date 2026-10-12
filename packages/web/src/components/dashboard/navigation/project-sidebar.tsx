import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { cn } from '@/lib/utils';
import { visibleProjectNavItems } from './project-nav-items';

/**
 * Navegación de una obra.
 *
 * Vivía como pestañas en el header y no entraba: con doce secciones el nav se
 * partía en dos filas y se comía la cabecera. En una columna, doce ítems con
 * ícono y etiqueta se leen de un vistazo y hay lugar para los que vengan.
 *
 * Sólo se monta adentro de una obra. Fuera, el riel angosto de
 * `dashboard-rail.tsx` sigue siendo la navegación.
 */
export function ProjectSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  // Misma queryKey que la página: no dispara un fetch extra, lee el caché.
  const { data } = useProject(projectId);

  if (!projectId) return null;

  const items = visibleProjectNavItems(data?.project.capabilities ?? []);

  return (
    <nav
      aria-label={t('project.nav.aria')}
      className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-3 md:flex"
    >
      <NavLink
        to={ROUTES.ADMIN}
        className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {t('layout.projects')}
      </NavLink>

      {/*
        El nombre de la obra NO va acá: el breadcrumb del header lo muestra y
        ese header está siempre a la vista. Repetirlo a diez centímetros no
        agrega nada y duplica el mismo texto en la pantalla.
      */}

      {items.map(({ labelKey, path, icon: Icon }) => {
        const to = path(projectId);
        // `end` no alcanza: el detalle es prefijo de todas las demás, así que
        // se compara el pathname completo.
        const isActive = pathname === to;

        return (
          <NavLink
            key={to}
            to={to}
            data-testid={`project-nav-${labelKey}`}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{t(`project.nav.${labelKey}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Las mismas secciones en mobile, como tira horizontal scrolleable debajo del
 * header.
 *
 * No va en la barra inferior: doce destinos no entran en un pulgar, y
 * meterlos ahí dejaría cada uno de 30px. La tira se desplaza, que es el gesto
 * que la gente ya hace en cualquier app con pestañas.
 */
export function ProjectNavScroller() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);

  if (!projectId) return null;

  const items = visibleProjectNavItems(data?.project.capabilities ?? []);

  return (
    <nav
      aria-label={t('project.nav.aria')}
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 md:hidden"
    >
      {items.map(({ labelKey, path, icon: Icon }) => {
        const to = path(projectId);
        const isActive = pathname === to;

        return (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <Icon className="size-4" />
            {t(`project.nav.${labelKey}`)}
          </NavLink>
        );
      })}
    </nav>
  );
}
