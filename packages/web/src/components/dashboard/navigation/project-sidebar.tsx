import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { cn } from '@/lib/utils';
import { NavRailItem, RAIL_WIDTH } from './nav-rail-item';
import {
  isProjectSectionActive,
  projectGroupTextKeys,
  projectNavGroups,
} from './project-nav-items';

/**
 * Navegación de una obra, en desktop: un riel con el ícono arriba y el nombre
 * debajo de cada destino, y en el tooltip qué se hace ahí (`NavRailItem`).
 *
 * Los destinos son los grupos de secciones (Resumen, Trabajo, Abastecimiento,
 * Dinero, Administración): doce secciones sueltas no entran en un riel sin
 * scroll. Cada grupo lleva a su primera sección, y las demás aparecen como
 * pestañas arriba de la pantalla (`ProjectSectionTabs`). Hitos y
 * Documentación son destinos propios. Personal y Equipo van juntos.
 *
 * Primero fueron pestañas en el header (con doce secciones se partían en dos
 * filas), después una columna de 224px con ícono y etiqueta al lado. Esa
 * columna se comía el ancho que el Tablero de tareas necesita.
 *
 * Arriba, la vuelta al listado de obras.
 */
export function ProjectSidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  // Misma queryKey que la página: no dispara un fetch extra, lee el caché.
  const { data } = useProject(projectId);

  if (!projectId) return null;

  const groups = projectNavGroups(data?.project.capabilities ?? []);

  return (
    <nav
      aria-label={t('project.nav.aria')}
      className={cn(
        RAIL_WIDTH,
        'hidden shrink-0 flex-col items-center gap-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-r border-border bg-card px-2 py-4 md:flex',
      )}
    >
      <NavRailItem
        to={ROUTES.ADMIN}
        end
        icon={ArrowLeft}
        label={t('layout.projects')}
        description={t('project.navHint.back')}
        isActive={false}
      />
      <div aria-hidden className="my-1 h-px w-8 shrink-0 bg-border" />

      {/*
        El nombre de la obra NO va acá: el breadcrumb del header lo muestra y
        ese header está siempre a la vista.
      */}
      {groups.map((entry) => {
        const { group, icon, items } = entry;
        const text = projectGroupTextKeys(entry);
        return (
          <NavRailItem
            key={group}
            to={items[0].path(projectId)}
            icon={icon}
            label={t(text.label)}
            description={t(text.hint)}
            isActive={items.some((item) => isProjectSectionActive(item, projectId, pathname))}
            testId={`project-group-${group}`}
          />
        );
      })}
    </nav>
  );
}

/**
 * Los mismos grupos en mobile, como tira horizontal scrolleable debajo del header; las
 * secciones de cada grupo son las pestañas de `ProjectSectionTabs`, que también se ven
 * acá. Mismo orden y mismos nombres que el riel de desktop.
 *
 * No va en la barra inferior: siete destinos no entran en un pulgar, y meterlos ahí
 * dejaría cada uno de 50px. La tira se desplaza, que es el gesto que la gente ya hace
 * en cualquier app con pestañas.
 */
export function ProjectNavScroller() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);

  if (!projectId) return null;

  const groups = projectNavGroups(data?.project.capabilities ?? []);

  return (
    <nav
      aria-label={t('project.nav.aria')}
      className="flex shrink-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-border bg-card px-2 py-2 md:hidden"
    >
      {groups.map((entry) => {
        const { group, icon: Icon, items } = entry;
        const text = projectGroupTextKeys(entry);
        const isActive = items.some((item) => isProjectSectionActive(item, projectId, pathname));

        return (
          <NavLink
            key={group}
            to={items[0].path(projectId)}
            data-tour-group={group}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary',
            )}
          >
            <Icon className="size-4" />
            {t(text.label)}
          </NavLink>
        );
      })}
    </nav>
  );
}
