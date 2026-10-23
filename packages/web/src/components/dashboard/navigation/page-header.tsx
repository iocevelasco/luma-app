import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { ROUTES } from '@/lib/routes';
import { DASHBOARD_DESTINATIONS } from './dashboard-destinations';
import { isProjectSectionActive, PROJECT_NAV_ITEMS } from './project-nav-items';

interface Crumb {
  label: string;
  to?: string;
}

/**
 * Título y camino de la pantalla, derivados de la URL.
 *
 * - Fuera de una obra: título = la sección ("Proveedores", "Nueva obra"…) y
 *   sin camino, porque ya está en el primer nivel.
 * - Adentro de una obra: camino "Obras › {obra}" y título = la subsección
 *   ("Cronograma", "Gastos"…). En la ficha de la obra el título es el nombre
 *   de la obra y el camino es sólo "Obras".
 *
 * Los nombres salen de las mismas listas que arman la navegación
 * (`DASHBOARD_DESTINATIONS`, `PROJECT_NAV_ITEMS`): una sección nueva aparece
 * acá sin tocar este archivo.
 */
function usePageTitle(): { title: string | null; crumbs: Crumb[] } {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);

  if (!projectId) {
    const destination = DASHBOARD_DESTINATIONS.find((item) => item.to === pathname);
    let title: string | null = null;
    if (destination) title = t(`layout.${destination.labelKey}`);
    else if (pathname === ROUTES.PROJECT_NEW) title = t('project.new.title');
    else if (pathname === ROUTES.ACCOUNT_SETTINGS) title = t('auth.account.title');
    else if (pathname === ROUTES.SUBSCRIPTION) title = t('subscription.title');

    // Nueva obra cuelga de Obras; el resto es de primer nivel.
    const crumbs: Crumb[] =
      pathname === ROUTES.PROJECT_NEW ? [{ label: t('layout.projects'), to: ROUTES.ADMIN }] : [];
    return { title, crumbs };
  }

  const crumbs: Crumb[] = [{ label: t('layout.projects'), to: ROUTES.ADMIN }];
  const section = PROJECT_NAV_ITEMS.find(
    (item) => item.labelKey !== 'detail' && isProjectSectionActive(item, projectId, pathname),
  );

  if (!data) return { title: null, crumbs };
  if (!section) return { title: data.project.name, crumbs };

  crumbs.push({ label: data.project.name, to: PROJECT_NAV_ITEMS[0].path(projectId) });
  return { title: t(`project.nav.${section.labelKey}`), crumbs };
}

/**
 * Título de la pantalla, en el header al lado de "Luma": el camino chico y el
 * nombre de la sección en serif de display. Se monta una sola vez en el
 * layout; las pantallas no llevan título propio.
 *
 * En mobile el camino se oculta y queda sólo el título: en 375px no entran
 * las dos cosas junto al logo y a los botones de la derecha.
 */
export function HeaderTitle() {
  const { title, crumbs } = usePageTitle();

  if (!title) return null;

  return (
    <div className="flex min-w-0 items-center gap-3 border-l border-border pl-3">
      {crumbs.length > 0 && (
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList className="flex-nowrap text-xs">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.to ? (
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to} className="max-w-[16vw] truncate">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
            <BreadcrumbSeparator />
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <h1 className="truncate font-serif text-2xl leading-none tracking-tight">{title}</h1>
    </div>
  );
}

export default HeaderTitle;
