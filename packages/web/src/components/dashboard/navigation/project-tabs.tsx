import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { projectActivitiesPath, projectDetailPath, projectMaterialsPath } from '@/lib/routes';
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

  if (!projectId) return null;

  const items = [
    { to: projectDetailPath(projectId), label: t('project.nav.detail') },
    { to: projectActivitiesPath(projectId), label: t('project.nav.gantt') },
    { to: projectMaterialsPath(projectId), label: t('project.nav.materials') },
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
