import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { cn } from '@/lib/utils';
import { NavRailItem } from './nav-rail-item';
import { isProjectSectionActive, visibleProjectNavItems } from './project-nav-items';

/**
 * Navegación de una obra, en desktop: un riel de íconos con tooltip.
 *
 * Primero fueron pestañas en el header (con doce secciones se partían en dos
 * filas), después una columna de 224px con ícono y etiqueta. Esa columna se
 * comía el ancho que el Tablero de tareas necesita, así que ahora es el mismo
 * riel angosto que fuera de una obra: ícono, y en el tooltip el nombre y qué
 * se hace en cada sección (`NavRailItem`).
 *
 * Arriba, la vuelta al listado de obras, separada de las secciones.
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
      className="hidden w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-card py-4 md:flex"
    >
      <NavRailItem
        to={ROUTES.ADMIN}
        end
        icon={ArrowLeft}
        label={t('layout.projects')}
        description={t('project.navHint.back')}
        isActive={false}
      />
      <div aria-hidden className="h-px w-8 shrink-0 bg-border" />

      {/*
        El nombre de la obra NO va acá: el breadcrumb del header lo muestra y
        ese header está siempre a la vista.
      */}
      {items.map((item) => {
        const { labelKey, path, icon } = item;
        const to = path(projectId);
        // `end` no alcanza: el detalle es prefijo de todas las demás.
        const isActive = isProjectSectionActive(item, projectId, pathname);

        return (
          <NavRailItem
            key={to}
            to={to}
            icon={icon}
            label={t(`project.nav.${labelKey}`)}
            description={t(`project.navHint.${labelKey}`)}
            isActive={isActive}
            testId={`project-nav-${labelKey}`}
          />
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
      {items.map((item) => {
        const { labelKey, path, icon: Icon } = item;
        const to = path(projectId);
        const isActive = isProjectSectionActive(item, projectId, pathname);

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
