import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { projectActivitiesPath, projectDetailPath, projectMaterialsPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface ProjectNavProps {
  projectId: string;
  projectName?: string;
}

/**
 * Encabezado de las subpáginas de una obra: nombre de la obra + navegación
 * entre detalle, cronograma y materiales. Sin esto, aterrizar directo en el
 * cronograma no dice de qué obra se trata.
 */
export function ProjectNav({ projectId, projectName }: ProjectNavProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const items = [
    { to: projectDetailPath(projectId), label: t('project.nav.detail') },
    { to: projectActivitiesPath(projectId), label: t('project.nav.gantt') },
    { to: projectMaterialsPath(projectId), label: t('project.nav.materials') },
  ];

  return (
    <div className="flex flex-col gap-1">
      {projectName && <h1 className="text-lg font-medium">{projectName}</h1>}
      <nav className="flex flex-wrap gap-2">
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
    </div>
  );
}

export default ProjectNav;
