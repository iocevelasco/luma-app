import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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

/** Breadcrumb del header: "Obras / {nombre de la obra}" en las subpáginas de una obra. */
export function Breadcrumbs() {
  const { t } = useTranslation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);

  if (!projectId) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={ROUTES.ADMIN}>{t('layout.projects')}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {data && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[40vw] truncate">
                {data.project.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default Breadcrumbs;
