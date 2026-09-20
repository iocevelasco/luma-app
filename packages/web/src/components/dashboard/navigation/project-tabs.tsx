import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import {
  projectActivitiesPath,
  projectBudgetPath,
  projectDetailPath,
  projectLaborPath,
  projectMaterialsPath,
} from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * Tabs entre las subpáginas de una obra — detalle, cronograma y materiales.
 *
 * Vive en el header fijo (ver dashboard-layout.tsx), no en cada página: ahí
 * abajo el contenido cambia de alto todo el tiempo (el gantt carga después
 * del proyecto, la lista de materiales crece), y un nav que vive en el flujo
 * normal de la página se corre de lugar cada vez que eso pasa.
 */
export function ProjectTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  // Misma queryKey que la página de detalle: no dispara un fetch extra, sólo
  // lee el caché ya poblado.
  const { data: projectData } = useProject(projectId);

  if (!projectId) return null;

  const isOwner = Boolean(projectData?.project.isOwner);

  const items = [
    { to: projectDetailPath(projectId), label: t('project.nav.detail') },
    { to: projectActivitiesPath(projectId), label: t('project.nav.gantt') },
    { to: projectMaterialsPath(projectId), label: t('project.nav.materials') },
    { to: projectLaborPath(projectId), label: t('project.nav.labor') },
    // Presupuesto es owner-only en este corte (regla 13): la utilidad del
    // ejecutante nunca es visible para el cliente. No mostrarle ni la pestaña.
    ...(isOwner
      ? [{ to: projectBudgetPath(projectId), label: t('project.nav.budget') }]
      : []),
  ];

  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            pathname === item.to
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default ProjectTabs;
