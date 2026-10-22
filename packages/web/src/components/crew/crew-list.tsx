import { useState } from 'react';
import type { OrganizationCrewMember } from '@luma/shared';
import { MapPin, Pencil, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ProjectAssignmentDialog } from '@/components/directory/project-assignment-dialog';
import { RowCardAction, RowCardList, RowCardMenu, RowCardMenuItem } from '@/components/common/row-card-list';
import { PersonRow } from '@/components/organization/person-row';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  useDeactivateOrganizationCrewMember,
  useOrganizationCrew,
  useSetCrewMemberProjects,
} from '@/hooks/organizations/use-organization-queries';
import { errorMessage } from '@/lib/error-message';

/**
 * El personal de obra de la Empresa, sea cual sea el rubro. Se comparte entre
 * obras: cada una sólo dispone de quienes tiene asignados.
 *
 * Alta y edición las abre quien lo contiene (`onEdit`): el botón de "sumar" es
 * uno solo para todo el equipo y vive arriba de la lista.
 */
export function CrewList({ onEdit }: { onEdit: (member: OrganizationCrewMember) => void }) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useOrganizationCrew();
  const deactivate = useDeactivateOrganizationCrewMember();
  const setProjects = useSetCrewMemberProjects();

  const [assigning, setAssigning] = useState<OrganizationCrewMember | null>(null);
  const [deactivating, setDeactivating] = useState<OrganizationCrewMember | null>(null);

  const crew = data?.crewMembers ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{errorMessage(error, t)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <>
      {crew.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('directory.crewEmpty')}</p>
      ) : (
        <RowCardList>
          {crew.map((member) => (
            <PersonRow
              key={member.id}
              name={member.name}
              badges={
                <>
                  {member.isLead && <Badge variant="info">{t('directory.lead')}</Badge>}
                  {member.kind === 'equipo' && (
                    <Badge>{t('crew.kind.equipo')}</Badge>
                  )}
                </>
              }
              details={[
                member.specialty ? t(`provider.specialty.${member.specialty}`) : null,
                member.phone,
                t('directory.projectsCount', { count: member.projectIds.length }),
              ]}
              // Visible: en qué obras está. Editar y dar de baja, en "…" (IA-11).
              actions={
                <>
                  <RowCardAction
                    type="button"
                    onClick={() => setAssigning(member)}
                    aria-label={t('directory.projectsTitle', { name: member.name })}
                  >
                    <MapPin aria-hidden className="size-4" />
                    {t('directory.projectsAction')}
                  </RowCardAction>
                  <RowCardMenu label={t('common.moreActions', { name: member.name })}>
                    <RowCardMenuItem onSelect={() => onEdit(member)}>
                      <Pencil className="size-4" />
                      {t('common.edit')}
                    </RowCardMenuItem>
                    <DropdownMenuSeparator />
                    <RowCardMenuItem variant="destructive" onSelect={() => setDeactivating(member)}>
                      <UserX className="size-4" />
                      {t('crew.list.deactivate')}
                    </RowCardMenuItem>
                  </RowCardMenu>
                </>
              }
            />
          ))}
        </RowCardList>
      )}

      {assigning && (
        <ProjectAssignmentDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setAssigning(null);
              setProjects.reset();
            }
          }}
          title={t('directory.projectsTitle', { name: assigning.name })}
          initialProjectIds={assigning.projectIds}
          isSubmitting={setProjects.isPending}
          error={setProjects.error}
          onSave={(projectIds) =>
            setProjects.mutate(
              { crewMemberId: assigning.id, projectIds },
              { onSuccess: () => setAssigning(null) },
            )
          }
        />
      )}

      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => !open && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('directory.confirmDeactivateCrewTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('directory.confirmDeactivateCrewBody', { name: deactivating?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deactivating) deactivate.mutate(deactivating.id);
                setDeactivating(null);
              }}
            >
              {t('crew.list.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
