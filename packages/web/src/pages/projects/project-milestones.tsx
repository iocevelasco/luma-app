import type { Milestone } from '@luma/shared';
import { format } from 'date-fns';
import { Flag, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useParams } from 'react-router-dom';
import { fromDayKey } from '@/components/common/date-range-filter';
import { PageLayout } from '@/components/layout/page-layout';
import { MilestoneCard } from '@/components/milestones/milestone-card';
import { Button } from '@/components/ui/button';
import { useMilestones } from '@/hooks/milestones/use-milestone-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { projectMilestoneNewPath } from '@/lib/routes';

/**
 * El alta es una ruta (`hitos/nuevo`) y no un estado: el `FormPanel` se monta
 * sobre este listado, sobrevive a una recarga y el "atrás" lo cierra.
 */
function NewMilestoneButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation();

  return (
    <Button asChild>
      <Link to={projectMilestoneNewPath(projectId)}>
        <Plus className="size-4" />
        {t('milestone.new.title')}
      </Link>
    </Button>
  );
}

/**
 * La cronología agrupada por mes. Con la fecha de cada card en "d MMM", el
 * encabezado del mes es el ancla que permite recorrerla: "¿qué pasó en
 * septiembre?" se contesta mirando un título, no leyendo fechas.
 *
 * La API ya devuelve los hitos ordenados por `occurredOn` descendente; acá
 * sólo se corta donde cambia el mes, sin reordenar.
 */
function groupByMonth(milestones: Milestone[]): { month: string; items: Milestone[] }[] {
  const groups: { month: string; items: Milestone[] }[] = [];
  for (const milestone of milestones) {
    const month = milestone.occurredOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.items.push(milestone);
    else groups.push({ month, items: [milestone] });
  }
  return groups;
}

export function ProjectMilestonesPage() {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useMilestones(projectId);
  const { can } = useProjectCapabilities(projectId);

  const canReport = can('milestone.report');
  const canPublish = can('milestone.publish');

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  return (
    <>
      <PageLayout
        action={canReport ? <NewMilestoneButton projectId={projectId!} /> : undefined}
        empty={
          data.milestones.length === 0
            ? {
                icon: Flag,
                title: t('milestone.empty.title'),
                description: canReport
                  ? t('milestone.empty.description')
                  : t('milestone.empty.descriptionReadOnly'),
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-6">
          {groupByMonth(data.milestones).map(({ month, items }) => (
            <section
              key={month}
              aria-labelledby={`milestones-${month}`}
              className="flex flex-col gap-3"
            >
              <h2
                id={`milestones-${month}`}
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {format(fromDayKey(`${month}-01`), 'LLLL yyyy', { locale: dateLocale })}
              </h2>
              <ul className="flex flex-col gap-3">
                {items.map((milestone) => (
                  <li key={milestone.id}>
                    <MilestoneCard
                      projectId={projectId!}
                      milestone={milestone}
                      canManage={canReport && (milestone.audience === 'interno' || canPublish)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageLayout>
      {/*
        Alta y edición (`hitos/nuevo`, `hitos/:id/editar`): fuera del
        `PageLayout`, que con la lista vacía no dibuja `children`.
      */}
      <Outlet />
    </>
  );
}

export default ProjectMilestonesPage;
