import { useState } from 'react';
import { format } from 'date-fns';
import { PLAN, type DeletedProject } from '@luma/shared';
import { Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/layout/page-layout';
import { RowCard, RowCardBody, RowCardEnd, RowCardList } from '@/components/common/row-card-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  // Restaurar una extra se cobra: se confirma antes, con el precio a la vista.
  const [confirming, setConfirming] = useState<DeletedProject | null>(null);

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
            >
              {project.restore.blockedBy && (
                <p className="text-xs text-muted-foreground">
                  {t(`project.trash.blocked.${project.restore.blockedBy}`, {
                    included: PLAN.includedProjects,
                  })}
                </p>
              )}
            </RowCardBody>
            <RowCardEnd>
              <Badge variant="outline">{t('project.trash.daysLeft', { count: project.daysLeft })}</Badge>
              <Button
                variant="secondary"
                size="sm"
                disabled={restore.isPending || !project.restore.allowed}
                onClick={() =>
                  project.restore.isExtra ? setConfirming(project) : restore.mutate(project.id)
                }
              >
                <Undo2 className="size-4" />
                {t('project.trash.restore')}
              </Button>
            </RowCardEnd>
          </RowCard>
        ))}
      </RowCardList>
      <AlertDialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('project.trash.restoreExtraTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('project.trash.restoreExtraBody', {
                name: confirming?.name ?? '',
                included: PLAN.includedProjects,
                price: PLAN.extraProjectPriceUsd,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) restore.mutate(confirming.id);
                setConfirming(null);
              }}
            >
              {t('project.trash.restoreConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

export default ProjectsTrashPage;
