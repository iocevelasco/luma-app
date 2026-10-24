import { format } from 'date-fns';
import { Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/layout/page-layout';
import { RowCard, RowCardBody, RowCardEnd, RowCardList } from '@/components/common/row-card-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useDeletedProjects, useRestoreProject } from '@/hooks/projects/use-project-queries';

/**
 * Las obras eliminadas de quien las creó. Se restauran durante 90 días; pasado
 * ese plazo desaparecen de acá y se borran de verdad.
 */
export function ProjectsTrashPage() {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { data, isLoading, isError } = useDeletedProjects();
  const restore = useRestoreProject();

  const projects = data?.projects ?? [];

  return (
    <PageLayout
      width="full"
      isLoading={isLoading}
      isError={isError}
      empty={
        projects.length === 0
          ? {
              icon: Trash2,
              title: t('project.trash.emptyTitle'),
              description: t('project.trash.emptyBody'),
            }
          : undefined
      }
    >
      <RowCardList>
        {projects.map((project) => (
          <RowCard key={project.id}>
            <RowCardBody
              title={project.name}
              meta={[
                project.location,
                t('project.trash.deletedOn', {
                  date: format(new Date(project.deletedAt), 'PP', { locale: dateLocale }),
                }),
              ].join(' · ')}
            />
            <RowCardEnd>
              <Badge variant="outline">{t('project.trash.daysLeft', { count: project.daysLeft })}</Badge>
              <Button
                variant="secondary"
                size="sm"
                disabled={restore.isPending}
                onClick={() => restore.mutate(project.id)}
              >
                <Undo2 className="size-4" />
                {t('project.trash.restore')}
              </Button>
            </RowCardEnd>
          </RowCard>
        ))}
      </RowCardList>
    </PageLayout>
  );
}

export default ProjectsTrashPage;
